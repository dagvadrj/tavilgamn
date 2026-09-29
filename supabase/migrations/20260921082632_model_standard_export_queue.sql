alter table public.furniture_models
  add column if not exists standard_glb_path text,
  add column if not exists export_status text not null default 'idle',
  add column if not exists export_error text,
  add column if not exists export_requested_at timestamptz,
  add column if not exists export_updated_at timestamptz,
  add column if not exists export_job_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'furniture_models_export_status_check'
      and conrelid = 'public.furniture_models'::regclass
  ) then
    alter table public.furniture_models
      add constraint furniture_models_export_status_check
      check (export_status in ('idle','queued','processing','ready','error'));
  end if;
end $$;

create index if not exists furniture_models_export_queue_idx
  on public.furniture_models (export_status, export_requested_at)
  where export_status = 'queued';

create or replace function public.request_furniture_model_export(
  p_actor uuid,
  p_model uuid
)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  target public.furniture_models;
  new_job uuid := gen_random_uuid();
begin
  perform 1
  from public.profiles
  where id = p_actor
    and role = 'admin';

  if not found then
    raise exception using
      errcode='42501',
      message='Admin required';
  end if;

  select *
  into target
  from public.furniture_models
  where id = p_model
  for update;

  if not found then
    raise exception using
      errcode='P0002',
      message='Model not found';
  end if;

  if target.processing_status <> 'ready'
     or target.high_glb_path is null then
    raise exception using
      errcode='55000',
      message='Optimized model is not ready';
  end if;

  if target.export_status in ('queued','processing') then
    return jsonb_build_object(
      'status', target.export_status,
      'jobId', target.export_job_id,
      'ready', false
    );
  end if;

  update public.furniture_models
  set
    export_status = 'queued',
    export_error = null,
    export_requested_at = now(),
    export_updated_at = now(),
    export_job_id = new_job
  where id = p_model;

  return jsonb_build_object(
    'status', 'queued',
    'jobId', new_job,
    'ready', false
  );
end
$function$;

create or replace function public.claim_furniture_model_export_job()
returns setof public.furniture_models
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  job public.furniture_models%rowtype;
begin
  select *
  into job
  from public.furniture_models
  where export_status = 'queued'
  order by export_requested_at asc nulls last
  for update skip locked
  limit 1;

  if not found then
    return;
  end if;

  update public.furniture_models
  set
    export_status = 'processing',
    export_error = null,
    export_updated_at = now()
  where id = job.id
    and export_job_id = job.export_job_id
    and export_status = 'queued'
  returning *
  into job;

  if not found then
    return;
  end if;

  return next job;
end
$function$;
