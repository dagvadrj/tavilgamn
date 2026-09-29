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
     or target.glb_path is null then
    raise exception using
      errcode='55000',
      message='Delivery model is not ready';
  end if;

  if target.export_status = 'ready'
     and target.standard_glb_path is not null then
    return jsonb_build_object(
      'status', 'ready',
      'jobId', target.export_job_id,
      'ready', true
    );
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

revoke all on function public.request_furniture_model_export(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.request_furniture_model_export(uuid, uuid)
  to service_role;
