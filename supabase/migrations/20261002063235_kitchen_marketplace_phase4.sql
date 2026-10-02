begin;

-- Keep identity/publication and version/review separate: an older approved
-- version may remain public while the merchant prepares its replacement.
alter table public.kitchen_design_versions
  add column price_to bigint,
  add column materials jsonb not null default '[]',
  add constraint kitchen_version_price_range check (
    price_to is null or (pricing_mode='from' and price_from is not null
      and price_to>=price_from and price_to<=9007199254740991)),
  add constraint kitchen_version_materials check (
    jsonb_typeof(materials)='array' and jsonb_array_length(materials)<=50
    and not jsonb_path_exists(materials,'$[*] ? (@.type() != "string")')
    and octet_length(materials::text)<=10000);

create table public.kitchen_marketplace_audit (
  id uuid primary key default gen_random_uuid(),
  design_id uuid not null references public.kitchen_designs(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete restrict,
  entity_id uuid not null,
  entity_type text not null,
  action text not null,
  metadata jsonb not null default '{}' check (jsonb_typeof(metadata)='object'),
  created_at timestamptz not null default clock_timestamp()
);
create index kitchen_audit_design_created_idx on public.kitchen_marketplace_audit(design_id,created_at desc,id);
create index kitchen_audit_actor_idx on public.kitchen_marketplace_audit(actor_id);
create unique index kitchen_audit_clone_once_idx on public.kitchen_marketplace_audit(design_id,actor_id,entity_id)
  where entity_type='kitchen_clone';
alter table public.kitchen_marketplace_audit enable row level security;
revoke all on public.kitchen_marketplace_audit from public,anon,authenticated,service_role;
grant select,insert on public.kitchen_marketplace_audit to service_role;

create table public.kitchen_render_policy (
  id boolean primary key default true check(id),
  requests_per_24h integer not null default 3 check(requests_per_24h between 0 and 100),
  enabled boolean not null default true
);
insert into public.kitchen_render_policy(id) values(true);
alter table public.kitchen_render_policy enable row level security;
revoke all on public.kitchen_render_policy from public,anon,authenticated;
grant select on public.kitchen_render_policy to service_role;

-- Record the authenticated actor inside the SAME transaction as each RPC.
-- Never accept an actor/audit record directly from the browser.
do $migration$
declare f record; definition text; body text; prefix text;
begin
  for f in select p.oid,p.prosrc,p.proargnames from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in (
      'create_kitchen_marketplace_design','save_kitchen_marketplace_version',
      'submit_kitchen_design','publish_kitchen_design','archive_kitchen_design',
      'add_kitchen_design_media','review_kitchen_design','request_kitchen_render',
      'claim_kitchen_render','complete_kitchen_render','fail_kitchen_render',
      'clone_published_kitchen_design','create_kitchen_quote_request','update_merchant_kitchen_quote')
  loop
    prefix:=E'begin\n  perform set_config(''app.kitchen_actor'',p_actor::text,true);';
    if 'p_design'=any(f.proargnames) then
      prefix:=prefix||E'\n  perform 1 from public.kitchen_designs where id=p_design for update;';
    elsif 'p_job'=any(f.proargnames) then
      prefix:=prefix||E'\n  perform 1 from public.kitchen_designs d join public.kitchen_design_versions v on v.design_id=d.id join public.kitchen_render_jobs j on j.version_id=v.id where j.id=p_job for update of d;';
    end if;
    body:=regexp_replace(f.prosrc,'\mbegin\M',prefix,'i');
    if body=f.prosrc then raise exception 'Kitchen RPC body not recognised'; end if;
    definition:=replace(pg_get_functiondef(f.oid),f.prosrc,body);
    execute definition;
  end loop;
end;
$migration$;

create function public.guard_kitchen_marketplace() returns trigger
language plpgsql security invoker set search_path='' as $$
declare actor uuid:=nullif(current_setting('app.kitchen_actor',true),'')::uuid;
  actor_role text; target public.kitchen_designs; version_status text;
begin
  select role into actor_role from public.profiles where id=actor;
  if actor is not null and (actor_role is null or actor_role not in ('merchant','admin')) then
    raise exception using errcode='42501',message='Merchant or admin required'; end if;
  if tg_table_name='kitchen_designs' then
    if new.publication_status='published' and (
      old.publication_status is distinct from new.publication_status or
      old.published_version_id is distinct from new.published_version_id) then
      if actor_role is distinct from 'admin' then
        raise exception using errcode='42501',message='Admin publication required';
      end if;
      if old.publication_status='archived' or not exists(
        select 1 from public.kitchen_design_versions v
        join public.merchant_stores s on s.id=new.store_id
        join public.profiles p on p.id=s.owner_id
        where v.id=new.published_version_id and v.design_id=new.id and v.review_status='approved'
          and s.active and s.store_type in ('factory','handmade') and p.role='merchant'
          and exists(select 1 from public.kitchen_design_media m
            where m.version_id=v.id and m.kind='thumbnail' and m.is_primary and m.status='ready')) then
        raise exception using errcode='P0012',message='Publishable approved version required';
      end if;
    end if;
    return new;
  end if;
  if tg_table_name='kitchen_design_versions' then
    select * into target from public.kitchen_designs where id=new.design_id for update;
    if actor_role='merchant' and (target.created_by<>actor or target.publication_status in ('archived','suspended')) then
      raise exception using errcode='42501',message='Editable design required';
    end if;
    if tg_op='UPDATE' then
      if old.review_status not in ('draft','changes_requested') and
        (to_jsonb(new)-array['review_status','submitted_at','approved_at','updated_at']) is distinct from
        (to_jsonb(old)-array['review_status','submitted_at','approved_at','updated_at']) then
        raise exception using errcode='P0012',message='Reviewed version content is immutable';
      end if;
      if new.review_status='submitted' and old.review_status<>'submitted' and exists(
        select 1 from public.kitchen_render_jobs where version_id=new.id and status in ('queued','processing')) then
        raise exception using errcode='P0016',message='Finish or cancel the active render before submission';
      end if;
    end if;
    return new;
  end if;
  select d.* into target from public.kitchen_designs d
    join public.kitchen_design_versions v on v.design_id=d.id where v.id=new.version_id for update of d;
  select review_status into version_status from public.kitchen_design_versions where id=new.version_id;
  if tg_table_name='kitchen_design_media' or
    (tg_table_name='kitchen_render_jobs' and (tg_op='INSERT' or new.status in ('processing','completed'))) then
    if target.publication_status in ('archived','suspended') or version_status not in ('draft','changes_requested') then
      raise exception using errcode='P0012',message='Editable kitchen version required';
    end if;
    if not exists(select 1 from public.merchant_stores s join public.profiles p on p.id=s.owner_id
      where s.id=target.store_id and s.active and s.store_type in ('factory','handmade') and p.role='merchant') then
      raise exception using errcode='42501',message='Eligible merchant required';
    end if;
    if tg_table_name='kitchen_render_jobs' and new.status='processing' and
      (new.metadata->>'consentVersion') is distinct from 'kitchen-ai-v1' then
      raise exception using errcode='P0017',message='Merchant AI consent required';
    end if;
  end if;
  return new;
end;
$$;
create trigger kitchen_design_publication_guard before update on public.kitchen_designs
  for each row execute function public.guard_kitchen_marketplace();
create trigger kitchen_version_guard before insert or update on public.kitchen_design_versions
  for each row execute function public.guard_kitchen_marketplace();
create trigger kitchen_media_guard before insert or update on public.kitchen_design_media
  for each row execute function public.guard_kitchen_marketplace();
create trigger kitchen_render_guard before insert or update on public.kitchen_render_jobs
  for each row execute function public.guard_kitchen_marketplace();

create function public.audit_kitchen_marketplace() returns trigger
language plpgsql security invoker set search_path='' as $$
declare row_data jsonb:=to_jsonb(new); old_data jsonb:='{}'; design uuid;
  action_name text; actor uuid:=nullif(current_setting('app.kitchen_actor',true),'')::uuid;
begin
  if tg_op='UPDATE' then old_data:=to_jsonb(old); end if;
  if tg_table_name='kitchen_designs' then
    design:=new.id;
    if tg_op='INSERT' then action_name:='design_created';
    elsif new.publication_status is distinct from old.publication_status or
      new.published_version_id is distinct from old.published_version_id then action_name:=new.publication_status;
    else return new; end if;
  elsif tg_table_name='kitchen_design_versions' then
    design:=new.design_id;
    action_name:=case when tg_op='INSERT' then 'version_created'
      when new.review_status is distinct from old.review_status then new.review_status else 'version_edited' end;
  elsif tg_table_name='kitchen_quote_requests' then
    design:=new.design_id; action_name:='quote_'||new.status;
    if tg_op='UPDATE' and new.status=old.status then return new; end if;
  elsif tg_table_name='kitchen_design_reviews' then
    design:=new.design_id; action_name:='review_'||new.action;
  else
    select design_id into design from public.kitchen_design_versions where id=new.version_id;
    action_name:=case when tg_table_name='kitchen_render_jobs' then 'render_'||new.status else 'media_'||lower(tg_op) end;
  end if;
  insert into public.kitchen_marketplace_audit(design_id,actor_id,entity_id,entity_type,action,metadata)
    values(design,actor,new.id,tg_table_name,action_name,jsonb_strip_nulls(jsonb_build_object(
      'versionId',row_data->'version_id','versionNo',row_data->'version_no',
      'fromStatus',coalesce(old_data->'review_status',old_data->'publication_status',old_data->'status'),
      'toStatus',coalesce(row_data->'review_status',row_data->'publication_status',row_data->'status'))));
  return new;
end;
$$;
create trigger kitchen_design_audit after insert or update on public.kitchen_designs for each row execute function public.audit_kitchen_marketplace();
create trigger kitchen_version_audit after insert or update on public.kitchen_design_versions for each row execute function public.audit_kitchen_marketplace();
create trigger kitchen_media_audit after insert or update on public.kitchen_design_media for each row execute function public.audit_kitchen_marketplace();
create trigger kitchen_review_audit after insert on public.kitchen_design_reviews for each row execute function public.audit_kitchen_marketplace();
create trigger kitchen_render_audit after insert or update on public.kitchen_render_jobs for each row execute function public.audit_kitchen_marketplace();
create trigger kitchen_quote_audit after insert or update on public.kitchen_quote_requests for each row execute function public.audit_kitchen_marketplace();

-- Preserve proven snapshot/copy logic, outside PostgREST's exposed schema.
do $migration$
declare f record; body text;
begin
  for f in select p.oid,p.prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('create_kitchen_marketplace_design','save_kitchen_marketplace_version')
  loop
    body:=replace(f.prosrc,'pricing_mode,price_from,lead_time_days',
      'pricing_mode,price_from,price_to,materials,lead_time_days');
    body:=replace(body,'nullif(p_payload->>''priceFrom'','''')::bigint,',
      'nullif(p_payload->>''priceFrom'','''')::bigint,nullif(p_payload->>''priceTo'','''')::bigint,coalesce(p_payload->''materials'',''[]''::jsonb),');
    -- The UPDATE path has an assignment, not a SELECT expression.
    body:=replace(body,'price_from=nullif(p_payload->>''priceFrom'','''')::bigint,nullif(p_payload->>''priceTo'','''')::bigint,coalesce(p_payload->''materials'',''[]''::jsonb),',
      'price_from=nullif(p_payload->>''priceFrom'','''')::bigint,price_to=nullif(p_payload->>''priceTo'','''')::bigint,materials=coalesce(p_payload->''materials'',''[]''::jsonb),');
    if body=f.prosrc then raise exception 'Kitchen listing RPC body not recognised'; end if;
    execute replace(pg_get_functiondef(f.oid),f.prosrc,body);
  end loop;
end;
$migration$;
create schema kitchen_internal;
revoke all on schema kitchen_internal from public,anon,authenticated;
grant usage on schema kitchen_internal to service_role;
alter function public.create_kitchen_marketplace_design(uuid,uuid,text,jsonb) set schema kitchen_internal;
alter function public.save_kitchen_marketplace_version(uuid,uuid,uuid,text,jsonb) set schema kitchen_internal;
create function public.create_kitchen_marketplace_design(p_actor uuid,p_source_id uuid,p_slug text,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
  result:=kitchen_internal.create_kitchen_marketplace_design(p_actor,p_source_id,p_slug,p_payload);
  return result;
end;
$$;
create function public.save_kitchen_marketplace_version(p_actor uuid,p_design uuid,p_version uuid,p_mode text,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb; project_data jsonb; cabinets jsonb; thumbnail text;
begin
  result:=kitchen_internal.save_kitchen_marketplace_version(p_actor,p_design,p_version,
    case when p_mode='sync_project' then 'edit' else p_mode end,p_payload);
  if p_mode='sync_project' then
    if exists(select 1 from public.kitchen_render_jobs where version_id=p_version and status in ('queued','processing')) then
      raise exception using errcode='P0016',message='Cancel active render before syncing'; end if;
    select g.design,g.thumbnail_url into project_data,thumbnail from public.kitchen_garnitures g
      join public.kitchen_designs d on d.source_garniture_id=g.id and d.created_by=g.user_id
      where d.id=p_design and g.user_id=p_actor for share of g;
    if not found then raise exception using errcode='P0002',message='Source kitchen project not found'; end if;
    cabinets:=project_data->'cabinets';
    if jsonb_typeof(cabinets) is distinct from 'array' or jsonb_array_length(cabinets) not between 1 and 80 then
      raise exception using errcode='22023',message='Invalid source kitchen'; end if;
    update public.kitchen_design_versions set design=project_data,layout=project_data->>'layout',
      cabinet_count=jsonb_array_length(cabinets),
      base_count=(select count(*) from jsonb_array_elements(cabinets) c where c->>'type'='base'),
      wall_count=(select count(*) from jsonb_array_elements(cabinets) c where c->>'type'='wall'),
      tall_count=(select count(*) from jsonb_array_elements(cabinets) c where c->>'type'='tall'),
      min_room_width_mm=(project_data#>>'{room,width}')::integer,min_room_depth_mm=(project_data#>>'{room,depth}')::integer,
      max_height_mm=(select max((c->>'height')::integer+(c#>>'{position,y}')::integer) from jsonb_array_elements(cabinets) c),
      component_product_ids=(select coalesce(jsonb_agg(distinct coalesce(c->>'variantId',c->>'productId'))
        filter(where coalesce(c->>'variantId',c->>'productId') is not null),'[]') from jsonb_array_elements(cabinets) c)
      where id=p_version;
    -- Derived pictures of the old geometry must never represent the new snapshot.
    update public.kitchen_design_media set status='rejected',is_primary=false
      where version_id=p_version and (source in ('system','ai') or kind='thumbnail');
    if thumbnail is not null then
      insert into public.kitchen_design_media(version_id,kind,source,url,is_primary)
        values(p_version,'thumbnail','system',thumbnail,true);
    end if;
  end if;
  return result;
end;
$$;

create or replace function public.review_kitchen_design(p_actor uuid,p_design uuid,p_version uuid,p_action text,p_note text default '')
returns void language plpgsql security invoker set search_path='' as $$
declare target public.kitchen_designs; normalized text:=p_action; review_id uuid;
begin
  perform set_config('app.kitchen_actor',p_actor::text,true);
  perform 1 from public.profiles where id=p_actor and role='admin' for share;
  if not found then raise exception using errcode='42501',message='Admin required'; end if;
  if p_action not in ('approved','changes_requested','rejected','unpublished','published','suspended') or
    char_length(coalesce(p_note,''))>5000 then raise exception using errcode='22023',message='Invalid review action'; end if;
  -- Rejected is retained only as historical evidence; new reviews use the seven-state lifecycle.
  if p_action='rejected' then normalized:='changes_requested'; end if;
  if p_action='suspended' then normalized:='unpublished'; end if;
  if normalized in ('changes_requested','unpublished') and btrim(coalesce(p_note,''))='' then
    raise exception using errcode='P0018',message='Review reason required';
  end if;
  select * into target from public.kitchen_designs where id=p_design for update;
  if not found then raise exception using errcode='P0002',message='Kitchen design not found'; end if;
  if target.publication_status='archived' then raise exception using errcode='P0012',message='Archived design is immutable'; end if;
  if normalized='published' then
    update public.kitchen_designs set publication_status='published',published_version_id=p_version,
      published_at=now() where id=p_design;
  elsif normalized='unpublished' then
    if target.publication_status<>'published' then raise exception using errcode='P0012',message='Published design required'; end if;
    update public.kitchen_designs set publication_status='suspended' where id=p_design;
  else
    if target.publication_status='suspended' then raise exception using errcode='P0012',message='Suspended design cannot be reviewed'; end if;
    perform 1 from public.kitchen_design_versions where id=p_version and design_id=p_design and review_status='submitted' for update;
    if not found then raise exception using errcode='P0012',message='Submitted kitchen version required'; end if;
    update public.kitchen_design_versions set review_status=normalized,
      approved_at=case when normalized='approved' then now() else null end where id=p_version;
  end if;
  if normalized<>'published' then
    insert into public.kitchen_design_reviews(design_id,version_id,reviewer_id,action,note)
      values(p_design,case when normalized='unpublished' then null else p_version end,p_actor,normalized,btrim(coalesce(p_note,'')))
      returning id into review_id;
  else review_id:=gen_random_uuid(); end if;
  insert into public.user_notifications(user_id,kind,title,body,href,entity_id,source_key,metadata)
    values(target.created_by,'kitchen_review',case normalized
      when 'approved' then 'Гал тогооны загвар зөвшөөрөгдлөө'
      when 'published' then 'Гал тогооны загвар нийтлэгдлээ'
      when 'unpublished' then 'Гал тогооны загвар түдгэлзлээ'
      else 'Гал тогооны загварт засвар хүссэн' end,
      btrim(coalesce(p_note,'')),'/merchant?tab=kitchens&design='||p_design,p_design,
      'kitchen-review:'||review_id,jsonb_build_object('designId',p_design,'versionId',p_version,'action',normalized));
end;
$$;

create or replace function public.publish_kitchen_design(p_actor uuid,p_design uuid,p_version uuid)
returns void language plpgsql security invoker set search_path='' as $$
begin
  perform public.review_kitchen_design(p_actor,p_design,p_version,'published','');
end;
$$;

drop function public.request_kitchen_render(uuid,uuid,uuid,uuid,text,text,text);
create function public.request_kitchen_render(
  p_actor uuid,p_design uuid,p_version uuid,p_source_media uuid,p_prompt text,p_provider text,p_model text,p_consent boolean default false
) returns uuid language plpgsql security invoker set search_path='' as $$
declare render_id uuid; source_url text; store text; used integer; policy public.kitchen_render_policy;
begin
  perform set_config('app.kitchen_actor',p_actor::text,true);
  if p_consent is distinct from true then raise exception using errcode='P0017',message='Merchant AI consent required'; end if;
  perform 1 from public.profiles where id=p_actor and role='merchant' for share;
  if not found then raise exception using errcode='42501',message='Merchant required'; end if;
  if char_length(btrim(coalesce(p_prompt,''))) not between 20 and 10000 or
    char_length(btrim(coalesce(p_provider,''))) not between 1 and 100 or
    char_length(btrim(coalesce(p_model,''))) not between 1 and 200 then
    raise exception using errcode='22023',message='Invalid render request';
  end if;
  select d.store_id,m.url into store,source_url from public.kitchen_designs d
    join public.merchant_stores s on s.id=d.store_id join public.kitchen_design_versions v on v.design_id=d.id
    join public.kitchen_design_media m on m.version_id=v.id
    where d.id=p_design and v.id=p_version and m.id=p_source_media
      and d.created_by=p_actor and s.owner_id=p_actor and s.active and s.store_type in ('factory','handmade')
      and d.publication_status not in ('archived','suspended') and v.review_status in ('draft','changes_requested')
      and m.status='ready' and m.kind in ('thumbnail','render','photo','plan') for update of d;
  if not found then raise exception using errcode='42501',message='Editable kitchen render source required'; end if;
  -- Serialize across ALL designs of the store so parallel requests cannot exceed quota.
  perform pg_advisory_xact_lock(hashtextextended(store,4));
  select * into policy from public.kitchen_render_policy where id=true for share;
  select count(*) into used from public.kitchen_render_jobs j join public.kitchen_design_versions v on v.id=j.version_id
    join public.kitchen_designs d on d.id=v.design_id where d.store_id=store and j.created_at>now()-interval '24 hours';
  if policy.enabled is distinct from true or used>=policy.requests_per_24h then
    raise exception using errcode='P0019',message='Kitchen render daily limit reached';
  end if;
  begin
    insert into public.kitchen_render_jobs(version_id,requested_by,input_image_url,prompt_snapshot,provider,model,metadata)
      values(p_version,p_actor,source_url,btrim(p_prompt),btrim(p_provider),btrim(p_model),
        jsonb_build_object('consentVersion','kitchen-ai-v1','consentedAt',now())) returning id into render_id;
  exception when unique_violation then raise exception using errcode='P0011',message='Active kitchen render already exists'; end;
  return render_id;
end;
$$;

create function public.read_kitchen_render_usage(p_actor uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare store text; used integer; reset_at timestamptz; policy public.kitchen_render_policy;
begin
  select s.id into store from public.merchant_stores s join public.profiles p on p.id=s.owner_id
    where s.owner_id=p_actor and s.active and s.store_type in ('factory','handmade') and p.role='merchant';
  if not found then raise exception using errcode='42501',message='Eligible merchant required'; end if;
  select * into policy from public.kitchen_render_policy where id=true;
  select count(*),min(j.created_at)+interval '24 hours' into used,reset_at
    from public.kitchen_render_jobs j join public.kitchen_design_versions v on v.id=j.version_id
    join public.kitchen_designs d on d.id=v.design_id where d.store_id=store and j.created_at>now()-interval '24 hours';
  return jsonb_build_object('limit',policy.requests_per_24h,'used',used,'enabled',policy.enabled,'nextResetAt',reset_at);
end;
$$;

create function public.cancel_kitchen_render(p_actor uuid,p_job uuid,p_note text) returns void
language plpgsql security invoker set search_path='' as $$
declare job public.kitchen_render_jobs; target_design uuid;
begin
  perform set_config('app.kitchen_actor',p_actor::text,true);
  perform 1 from public.kitchen_designs d join public.kitchen_design_versions v on v.design_id=d.id
    join public.kitchen_render_jobs j on j.version_id=v.id where j.id=p_job for update of d;
  select j.* into job from public.kitchen_render_jobs j join public.kitchen_design_versions v on v.id=j.version_id
    join public.kitchen_designs d on d.id=v.design_id where j.id=p_job
      and ((j.requested_by=p_actor and d.created_by=p_actor) or exists(select 1 from public.profiles where id=p_actor and role='admin')) for update of j;
  if not found then raise exception using errcode='42501',message='Render owner or admin required'; end if;
  if job.status<>'queued' then raise exception using errcode='P0012',message='Only queued renders can be cancelled'; end if;
  if char_length(btrim(coalesce(p_note,''))) not between 1 and 5000 then
    raise exception using errcode='P0018',message='Cancellation reason required'; end if;
  update public.kitchen_render_jobs set status='cancelled',error=btrim(p_note),finished_at=now() where id=p_job;
  select design_id into target_design from public.kitchen_design_versions where id=job.version_id;
  insert into public.user_notifications(user_id,kind,title,body,href,entity_id,source_key,metadata)
    values(job.requested_by,'kitchen_review','AI render хүсэлт цуцлагдлаа',btrim(p_note),
      '/merchant?tab=kitchens&design='||target_design,target_design,'kitchen-render-cancel:'||p_job,jsonb_build_object('designId',target_design,'jobId',p_job));
end;
$$;

-- Add notifications for finished renders, and exact links for quote events.
create function public.notify_kitchen_render_result() returns trigger
language plpgsql security invoker set search_path='' as $$
declare design uuid;
begin
  if new.status is distinct from old.status and new.status in ('completed','failed') then
    select design_id into design from public.kitchen_design_versions where id=new.version_id;
    insert into public.user_notifications(user_id,kind,title,body,href,entity_id,source_key,metadata)
      values(new.requested_by,'kitchen_review',case new.status when 'completed' then 'AI render бэлэн боллоо' else 'AI render амжилтгүй боллоо' end,
        case new.status when 'completed' then 'AI зураг gallery-д нэмэгдлээ.' else 'Admin-д хандаж дахин хүсэлт гаргана уу.' end,
        '/merchant?tab=kitchens&design='||design,design,'kitchen-render:'||new.id||':'||new.status,
        jsonb_build_object('designId',design,'jobId',new.id,'status',new.status));
  end if;
  return new;
end;
$$;
create trigger kitchen_render_result_notification after update on public.kitchen_render_jobs
  for each row execute function public.notify_kitchen_render_result();

-- Consent remains available after provider metadata is added on completion/failure.
do $migration$
declare f record; body text;
begin
  for f in select p.oid,p.prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('complete_kitchen_render','fail_kitchen_render')
  loop
    body:=replace(f.prosrc,'metadata=coalesce(p_metadata','metadata=metadata||coalesce(p_metadata');
    execute replace(pg_get_functiondef(f.oid),f.prosrc,body);
  end loop;
end;
$migration$;

do $migration$
declare f record; body text;
begin
  select p.oid,p.prosrc into f from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='clone_published_kitchen_design';
  body:=replace(f.prosrc,'return jsonb_build_object(',
    'insert into public.kitchen_marketplace_audit(design_id,actor_id,entity_id,entity_type,action,metadata) values(p_design,p_actor,p_project,''kitchen_clone'',''customer_cloned'',jsonb_build_object(''versionId'',source_version)) on conflict do nothing; return jsonb_build_object(');
  if body=f.prosrc then raise exception 'Clone RPC body not recognised'; end if;
  execute replace(pg_get_functiondef(f.oid),f.prosrc,body);
end;
$migration$;

-- A notification can open an older quote without paging through newer requests.
do $migration$
declare f record; body text; clause text;
begin
  for f in select p.proname,p.prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('read_merchant_kitchen_quotes','read_customer_kitchen_quotes')
  loop
    clause:=case when f.proname='read_merchant_kitchen_quotes' then
      'where q.merchant_owner_id=p_actor and q.store_id=target_store' else 'where q.customer_id=p_actor' end;
    body:=replace(f.prosrc,clause,clause||' and (p_focus is null or q.id=p_focus)');
    if body=f.prosrc then raise exception 'Quote read body not recognised'; end if;
    execute format('drop function public.%I(uuid,integer)',f.proname);
    execute format('create function public.%I(p_actor uuid,p_page integer default 0,p_focus uuid default null) returns jsonb language plpgsql security invoker set search_path='''' as %L',f.proname,body);
  end loop;
end;
$migration$;

create function public.kitchen_quote_notification_link() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.kind='kitchen_quote' and new.entity_id is not null then
    new.href:=case when new.href like '/merchant%%' then '/merchant?tab=quotes&quote='||new.entity_id
      else '/account?quote='||new.entity_id||'#kitchen-quotes' end;
  end if;
  return new;
end;
$$;
create trigger kitchen_quote_exact_notification before insert on public.user_notifications
  for each row execute function public.kitchen_quote_notification_link();
update public.user_notifications set href=case when href like '/merchant%%' then '/merchant?tab=quotes&quote='||entity_id
  else '/account?quote='||entity_id||'#kitchen-quotes' end where kind='kitchen_quote' and entity_id is not null;

alter policy kitchen_designs_public on public.kitchen_designs using (
  publication_status='published' and exists(select 1 from public.merchant_stores s
    where s.id=store_id and s.active and s.store_type in ('factory','handmade')));
alter policy kitchen_design_versions_public on public.kitchen_design_versions using (
  review_status='approved' and exists(select 1 from public.kitchen_designs d
    where d.id=design_id and d.publication_status='published' and d.published_version_id=kitchen_design_versions.id));

-- Trigger-only functions are not callable by browser roles.
revoke all on function public.guard_kitchen_marketplace(),public.audit_kitchen_marketplace(),public.notify_kitchen_render_result(),
  public.kitchen_quote_notification_link(),public.read_merchant_kitchen_quotes(uuid,integer,uuid),public.read_customer_kitchen_quotes(uuid,integer,uuid),
  public.create_kitchen_marketplace_design(uuid,uuid,text,jsonb),public.save_kitchen_marketplace_version(uuid,uuid,uuid,text,jsonb),
  public.request_kitchen_render(uuid,uuid,uuid,uuid,text,text,text,boolean),public.read_kitchen_render_usage(uuid),public.cancel_kitchen_render(uuid,uuid,text)
  from public,anon,authenticated;
grant execute on function public.guard_kitchen_marketplace(),public.audit_kitchen_marketplace(),public.notify_kitchen_render_result(),
  public.kitchen_quote_notification_link(),public.read_merchant_kitchen_quotes(uuid,integer,uuid),public.read_customer_kitchen_quotes(uuid,integer,uuid),
  public.create_kitchen_marketplace_design(uuid,uuid,text,jsonb),public.save_kitchen_marketplace_version(uuid,uuid,uuid,text,jsonb),
  public.request_kitchen_render(uuid,uuid,uuid,uuid,text,text,text,boolean),public.read_kitchen_render_usage(uuid),public.cancel_kitchen_render(uuid,uuid,text)
  to service_role;

notify pgrst,'reload schema';
commit;
