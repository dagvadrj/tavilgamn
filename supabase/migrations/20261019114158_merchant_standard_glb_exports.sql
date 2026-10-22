-- Merchant requests use the same bounded export worker as admin requests.
-- Role and ownership are checked again under locks, never supplied by the browser.
create or replace function public.request_merchant_model_export(p_actor uuid, p_product text)
returns jsonb language plpgsql volatile security invoker set search_path to '' as $$
declare
  sid text;
  target public.furniture_models;
  new_job uuid := gen_random_uuid();
begin
  sid := public.merchant_delivery_store(p_actor);
  select * into target from public.furniture_models
    where product_id = p_product and archived_at is null
      and store_ids = jsonb_build_array(sid)
    for update;
  if not found then
    raise exception using errcode='P0002', message='Model not found';
  end if;
  if target.processing_status <> 'ready' or target.glb_path is null then
    raise exception using errcode='55000', message='Delivery model is not ready';
  end if;
  if target.export_status = 'ready' and target.standard_glb_path is not null then
    return jsonb_build_object('status','ready','ready',true);
  end if;
  if target.export_status in ('queued','processing') then
    return jsonb_build_object('status',target.export_status,'ready',false);
  end if;
  update public.furniture_models set export_status='queued', export_error=null,
    export_requested_at=now(), export_updated_at=now(), export_job_id=new_job
    where id=target.id;
  return jsonb_build_object('status','queued','ready',false);
end $$;
revoke all on function public.request_merchant_model_export(uuid,text) from public, anon, authenticated;
grant execute on function public.request_merchant_model_export(uuid,text) to service_role;
