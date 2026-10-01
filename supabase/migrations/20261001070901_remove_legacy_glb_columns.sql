-- Contract only AFTER the public site and every worker use preview_glb_path.
-- R2 objects are deliberately untouched. glb_path remains the delivery model.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Catch any writes made by an old worker between expansion and deployment.
update public.furniture_models
set preview_glb_path = low_glb_path
where preview_glb_path is null and low_glb_path is not null;

create or replace function public.admin_3d_model_requests(p_actor uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $function$
declare
  result jsonb;
begin
  perform 1 from public.profiles where id = p_actor and role = 'admin';
  if not found then
    raise exception using errcode = '42501', message = 'Admin required';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'modelId', m.id,
    'productId', m.product_id,
    'productName', m.name,
    'category', m.category,
    'image', m.image_url,
    'storeId', s.id,
    'storeName', s.name,
    'requestedAt', m.model_requested_at,
    'processingStatus', m.processing_status,
    'processingError', m.processing_error,
    'sourcePath', m.source_glb_path,
    'deliveryPath', m.glb_path,
    'previewPath', m.preview_glb_path
  ) order by m.model_requested_at asc nulls last, m.updated_at asc), '[]'::jsonb)
  into result
  from public.furniture_models m
  left join public.merchant_stores s on s.id = m.model_requested_by_store_id
  where m.model_requested = true;
  return result;
end
$function$;

-- This RPC is used only by the authenticated administrator's server route.
revoke execute on function public.admin_3d_model_requests(uuid)
  from public, anon, authenticated;
grant execute on function public.admin_3d_model_requests(uuid) to service_role;

alter table public.furniture_models
  drop column high_glb_path,
  drop column medium_glb_path,
  drop column low_glb_path;

commit;
