begin;

alter table public.kitchen_render_jobs
  add column metadata jsonb not null default '{}'
  check (jsonb_typeof(metadata)='object' and octet_length(metadata::text)<=50000);

create unique index kitchen_render_jobs_one_active_idx
  on public.kitchen_render_jobs(version_id)
  where status in ('queued','processing');

create function public.request_kitchen_render(
  p_actor uuid,p_design uuid,p_version uuid,p_source_media uuid,p_prompt text,p_provider text,p_model text
) returns uuid language plpgsql security invoker set search_path='' as $$
declare render_id uuid; source_url text;
begin
  perform 1 from public.profiles where id=p_actor and role='merchant' for share;
  if not found then raise exception using errcode='42501',message='Merchant required'; end if;
  if char_length(btrim(coalesce(p_prompt,''))) not between 20 and 10000 then
    raise exception using errcode='22023',message='Invalid render prompt';
  end if;
  if char_length(btrim(coalesce(p_provider,''))) not between 1 and 100
    or char_length(btrim(coalesce(p_model,''))) not between 1 and 200 then
    raise exception using errcode='22023',message='Invalid render provider';
  end if;
  select m.url into source_url
  from public.kitchen_designs d
  join public.merchant_stores s on s.id=d.store_id
  join public.kitchen_design_versions v on v.design_id=d.id
  join public.kitchen_design_media m on m.version_id=v.id
  where d.id=p_design and v.id=p_version and m.id=p_source_media
    and d.created_by=p_actor and s.owner_id=p_actor and s.active
    and s.store_type in ('factory','handmade')
    and d.publication_status<>'archived'
    and v.review_status in ('draft','changes_requested')
    and m.status='ready' and m.kind in ('thumbnail','render','photo','plan')
  for share of d,s,v,m;
  if not found then raise exception using errcode='42501',message='Editable kitchen render source required'; end if;
  begin
    insert into public.kitchen_render_jobs(version_id,requested_by,input_image_url,prompt_snapshot,provider,model)
      values(p_version,p_actor,source_url,btrim(p_prompt),btrim(p_provider),btrim(p_model))
      returning id into render_id;
  exception when unique_violation then
    raise exception using errcode='P0011',message='Active kitchen render already exists';
  end;
  return render_id;
end;
$$;

create function public.claim_kitchen_render(p_actor uuid,p_job uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare job_data jsonb;
begin
  perform 1 from public.profiles where id=p_actor and role='admin' for share;
  if not found then raise exception using errcode='42501',message='Admin required'; end if;
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

create function public.complete_kitchen_render(
  p_actor uuid,p_job uuid,p_url text,p_alt text,p_width integer,p_height integer,p_metadata jsonb
) returns uuid language plpgsql security invoker set search_path='' as $$
declare target_job public.kitchen_render_jobs; media_id uuid;
begin
  perform 1 from public.profiles where id=p_actor and role='admin' for share;
  if not found then raise exception using errcode='42501',message='Admin required'; end if;
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
    metadata=coalesce(p_metadata,'{}'::jsonb),finished_at=now(),error=null where id=p_job;
  return media_id;
end;
$$;

create function public.fail_kitchen_render(p_actor uuid,p_job uuid,p_error text,p_metadata jsonb default '{}')
returns void language plpgsql security invoker set search_path='' as $$
begin
  perform 1 from public.profiles where id=p_actor and role='admin' for share;
  if not found then raise exception using errcode='42501',message='Admin required'; end if;
  update public.kitchen_render_jobs set status='failed',error=left(coalesce(p_error,'Generation failed'),5000),
    metadata=coalesce(p_metadata,'{}'::jsonb),finished_at=now()
    where id=p_job and status in ('queued','processing');
  if not found then raise exception using errcode='P0002',message='Active kitchen render not found'; end if;
end;
$$;

revoke all on function public.request_kitchen_render(uuid,uuid,uuid,uuid,text,text,text),
  public.claim_kitchen_render(uuid,uuid),
  public.complete_kitchen_render(uuid,uuid,text,text,integer,integer,jsonb),
  public.fail_kitchen_render(uuid,uuid,text,jsonb)
from public,anon,authenticated;

grant execute on function public.request_kitchen_render(uuid,uuid,uuid,uuid,text,text,text),
  public.claim_kitchen_render(uuid,uuid),
  public.complete_kitchen_render(uuid,uuid,text,text,integer,integer,jsonb),
  public.fail_kitchen_render(uuid,uuid,text,jsonb)
to service_role;

notify pgrst,'reload schema';
commit;
