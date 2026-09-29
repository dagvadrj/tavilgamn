-- Recovery migration reconstructed from the live project schema on 2026-09-29.
-- The original model-processing migration was applied before migration history
-- was tracked and is not present in Git. Keep this file before the merchant and
-- standard-export migrations that depend on these columns and this RPC.

alter table public.furniture_models
  add column if not exists source_glb_path text,
  add column if not exists high_glb_path text,
  add column if not exists medium_glb_path text,
  add column if not exists low_glb_path text,
  add column if not exists processing_status text not null default 'idle',
  add column if not exists processing_error text,
  add column if not exists processing_requested_at timestamptz,
  add column if not exists processing_updated_at timestamptz default now(),
  add column if not exists processing_job_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'furniture_models_processing_status_check'
      and conrelid = 'public.furniture_models'::regclass
  ) then
    alter table public.furniture_models
      add constraint furniture_models_processing_status_check
      check (processing_status in ('idle', 'queued', 'processing', 'ready', 'error'));
  end if;
end
$$;

create index if not exists furniture_models_processing_requested_idx
  on public.furniture_models (processing_requested_at);

create index if not exists furniture_models_processing_status_idx
  on public.furniture_models (processing_status);

create or replace function public.claim_furniture_model_job()
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
  where processing_status = 'queued'
  order by processing_requested_at asc nulls last
  for update skip locked
  limit 1;

  if not found then
    return;
  end if;

  update public.furniture_models
  set
    processing_status = 'processing',
    processing_error = null,
    processing_updated_at = now()
  where id = job.id
    and processing_job_id = job.processing_job_id
    and processing_status = 'queued'
  returning *
  into job;

  if not found then
    return;
  end if;

  return next job;
end;
$function$;

revoke all on function public.claim_furniture_model_job()
  from public, anon, authenticated;
grant execute on function public.claim_furniture_model_job()
  to service_role;
