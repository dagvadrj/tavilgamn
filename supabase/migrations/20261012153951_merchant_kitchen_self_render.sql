begin;

create or replace function public.request_kitchen_render(
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
  -- The design row lock serializes requests across every version of this design.
  select * into policy from public.kitchen_render_policy where id=true for share;
  select count(*) into used from public.kitchen_render_jobs j join public.kitchen_design_versions v on v.id=j.version_id
    where v.design_id=p_design and j.status in ('completed','queued','processing');
  if policy.enabled is distinct from true then raise exception using errcode='P0022',message='Kitchen render disabled'; end if;
  if exists(select 1 from public.kitchen_render_jobs j join public.kitchen_design_versions v on v.id=j.version_id where v.design_id=p_design and j.status in ('queued','processing')) then raise exception using errcode='P0011',message='Active kitchen render already exists'; end if;
  if used>=3 then raise exception using errcode='P0019',message='Kitchen design render limit reached'; end if;
  begin
    insert into public.kitchen_render_jobs(version_id,requested_by,input_image_url,prompt_snapshot,provider,model,metadata)
      values(p_version,p_actor,source_url,btrim(p_prompt),btrim(p_provider),btrim(p_model),
        jsonb_build_object('consentVersion','kitchen-ai-v1','consentedAt',now())) returning id into render_id;
  exception when unique_violation then raise exception using errcode='P0011',message='Active kitchen render already exists'; end;
  return render_id;
end;
$$;

create function public.assert_kitchen_render_actor(p_actor uuid,p_job uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare actor_role text; creator uuid; owner uuid; requester uuid;
begin
  perform set_config('app.kitchen_actor',p_actor::text,true);
  select role into actor_role from public.profiles where id=p_actor for share;
  if actor_role is null or actor_role not in ('merchant','admin') then raise exception using errcode='42501',message='Kitchen render actor required'; end if;
  select d.created_by,s.owner_id,j.requested_by into creator,owner,requester
    from public.kitchen_render_jobs j join public.kitchen_design_versions v on v.id=j.version_id
    join public.kitchen_designs d on d.id=v.design_id join public.merchant_stores s on s.id=d.store_id
    where j.id=p_job for update of d;
  if not found then raise exception using errcode='P0002',message='Kitchen render not found'; end if;
  if actor_role='merchant' and (creator<>p_actor or owner<>p_actor or requester<>p_actor) then raise exception using errcode='42501',message='Own kitchen render required'; end if;
end;
$$;

create or replace function public.claim_kitchen_render(p_actor uuid,p_job uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare job_data jsonb;
begin
  perform public.assert_kitchen_render_actor(p_actor,p_job);
  update public.kitchen_render_jobs
    set status='processing',started_at=now(),finished_at=null,error=null
    where id=p_job and status='queued'
    returning jsonb_build_object(
      'id',id,'versionId',version_id,'inputImageUrl',input_image_url,
      'prompt',prompt_snapshot,'provider',provider,'model',model
    ) into job_data;
  if job_data is null then raise exception using errcode='P0002',message='Queued kitchen render not found'; end if;
  return job_data;
end;
$$;

create or replace function public.complete_kitchen_render(
  p_actor uuid,p_job uuid,p_url text,p_alt text,p_width integer,p_height integer,p_metadata jsonb
) returns uuid language plpgsql security invoker set search_path='' as $$
declare target_job public.kitchen_render_jobs; media_id uuid;
begin
  perform public.assert_kitchen_render_actor(p_actor,p_job);
  select * into target_job from public.kitchen_render_jobs where id=p_job and status='processing' for update;
  if not found then raise exception using errcode='P0002',message='Processing kitchen render not found'; end if;
  if char_length(coalesce(p_url,'')) not between 8 and 2000
    or p_width not between 1 and 20000 or p_height not between 1 and 20000
    or jsonb_typeof(coalesce(p_metadata,'{}'::jsonb)) is distinct from 'object'
    or octet_length(coalesce(p_metadata,'{}'::jsonb)::text)>50000 then
    raise exception using errcode='22023',message='Invalid render output';
  end if;
  insert into public.kitchen_design_media(version_id,kind,source,url,alt_text,is_primary,width,height,metadata)
    values(target_job.version_id,'ai_render','ai',p_url,left(coalesce(p_alt,''),300),false,p_width,p_height,coalesce(p_metadata,'{}'::jsonb))
    returning id into media_id;
  update public.kitchen_render_jobs set status='completed',output_media_id=media_id,
    metadata=metadata||coalesce(p_metadata,'{}'::jsonb),finished_at=now(),error=null where id=p_job;
  return media_id;
end;
$$;

create or replace function public.fail_kitchen_render(p_actor uuid,p_job uuid,p_error text,p_metadata jsonb default '{}')
returns void language plpgsql security invoker set search_path='' as $$
begin
  perform public.assert_kitchen_render_actor(p_actor,p_job);
  update public.kitchen_render_jobs set status='failed',error=left(coalesce(p_error,'Generation failed'),5000),
    metadata=metadata||coalesce(p_metadata,'{}'::jsonb),finished_at=now()
    where id=p_job and status in ('queued','processing');
  if not found then raise exception using errcode='P0002',message='Active kitchen render not found'; end if;
end;
$$;

create function public.read_kitchen_design_render_usage(p_actor uuid,p_design uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare used integer; enabled boolean;
begin
  perform 1 from public.kitchen_designs d join public.merchant_stores s on s.id=d.store_id join public.profiles p on p.id=s.owner_id
    where d.id=p_design and d.created_by=p_actor and s.owner_id=p_actor and s.active and s.store_type in ('factory','handmade') and p.role='merchant';
  if not found then raise exception using errcode='42501',message='Own kitchen design required'; end if;
  select count(*) into used from public.kitchen_render_jobs j join public.kitchen_design_versions v on v.id=j.version_id
    where v.design_id=p_design and j.status in ('completed','queued','processing');
  select p.enabled into enabled from public.kitchen_render_policy p where p.id=true;
  return jsonb_build_object('limit',3,'used',used,'enabled',coalesce(enabled,false),'nextResetAt',null);
end;
$$;

create or replace function public.notify_kitchen_render_result() returns trigger
language plpgsql security invoker set search_path='' as $$
declare design uuid;
begin
  if new.status is distinct from old.status and new.status in ('completed','failed') then
    select design_id into design from public.kitchen_design_versions where id=new.version_id;
    insert into public.user_notifications(user_id,kind,title,body,href,entity_id,source_key,metadata)
      values(new.requested_by,'kitchen_review',case new.status when 'completed' then 'AI render бэлэн боллоо' else 'AI render амжилтгүй боллоо' end,
        case new.status when 'completed' then 'AI зураг gallery-д нэмэгдлээ.' else 'Эх зургаа шалгаад дахин render хийнэ үү.' end,
        '/merchant/kitchens/'||design,design,'kitchen-render:'||new.id||':'||new.status,
        jsonb_build_object('designId',design,'jobId',new.id,'status',new.status));
  end if;
  return new;
end;
$$;

revoke all on function public.assert_kitchen_render_actor(uuid,uuid),
  public.read_kitchen_design_render_usage(uuid,uuid),
  public.request_kitchen_render(uuid,uuid,uuid,uuid,text,text,text,boolean),
  public.claim_kitchen_render(uuid,uuid),
  public.complete_kitchen_render(uuid,uuid,text,text,integer,integer,jsonb),
  public.fail_kitchen_render(uuid,uuid,text,jsonb),
  public.notify_kitchen_render_result() from public,anon,authenticated;
grant execute on function public.assert_kitchen_render_actor(uuid,uuid),
  public.read_kitchen_design_render_usage(uuid,uuid),
  public.request_kitchen_render(uuid,uuid,uuid,uuid,text,text,text,boolean),
  public.claim_kitchen_render(uuid,uuid),
  public.complete_kitchen_render(uuid,uuid,text,text,integer,integer,jsonb),
  public.fail_kitchen_render(uuid,uuid,text,jsonb),
  public.notify_kitchen_render_result() to service_role;

notify pgrst,'reload schema';
commit;
