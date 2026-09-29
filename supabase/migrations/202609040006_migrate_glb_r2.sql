begin;
create or replace function public.migrate_model_glb_r2(
  p_id uuid, p_expected text, p_new text
) returns boolean language plpgsql security invoker set search_path = '' as $$
declare current_path text; product_data jsonb;
begin
  if p_new !~ ('^r2://[a-z0-9-]+/models/' || p_id::text || '/model[.]glb$') then
    raise exception 'Invalid R2 reference';
  end if;
  select glb_path into current_path from public.furniture_models where id = p_id for update;
  if not found or current_path is distinct from p_expected then return false; end if;
  select data into product_data from public.products where id = p_id::text for update;
  update public.furniture_models set glb_path = p_new where id = p_id;
  -- Retain the exact catalog metadata; only the model filename changes.
  if product_data is not null then
    update public.products set
      data = jsonb_set(product_data, '{model,file}', to_jsonb('model.glb'::text)),
      updated_at = now()
    where id = p_id::text;
  end if;
  return true;
end;
$$;
revoke all on function public.migrate_model_glb_r2(uuid,text,text) from public, anon, authenticated;
grant execute on function public.migrate_model_glb_r2(uuid,text,text) to service_role;
commit;
