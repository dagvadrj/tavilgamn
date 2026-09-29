create or replace function public.save_merchant_product_v2(
  p_actor uuid,
  p_data jsonb,
  p_create boolean,
  p_model_requested boolean default false,
  p_expected_stock integer default null
)
returns void
language plpgsql
set search_path to ''
as $function$
declare
  store_id text;
  current_product public.furniture_models;
  safe_data jsonb;
  requested_before boolean := false;
begin
  perform 1
  from public.profiles
  where id = p_actor and role = 'merchant'
  for share;

  if not found then
    raise exception using errcode='42501', message='Merchant required';
  end if;

  select id into store_id
  from public.merchant_stores
  where owner_id = p_actor and active
  for share;

  if not found then
    raise exception using errcode='42501', message='Active store required';
  end if;

  if not p_create then
    select * into current_product
    from public.furniture_models
    where product_id = p_data->>'id'
      and store_ids = jsonb_build_array(store_id)
    for update;

    if not found then
      raise exception using errcode='P0002', message='Product not found';
    end if;

    requested_before := current_product.model_requested;
  end if;

  safe_data :=
    p_data
    || jsonb_build_object(
      'storeIds', jsonb_build_array(store_id),
      'rating', coalesce(current_product.rating, 0),
      'reviewCount', coalesce(current_product.review_count, 0),
      'badges', coalesce(current_product.badges, '[]'::jsonb),
      'isNew', coalesce(current_product.is_new, false),
      'isBestSeller', coalesce(current_product.is_best_seller, false)
    );

  perform public.save_furniture_product(
    safe_data,
    p_create,
    p_expected_stock
  );

  update public.furniture_models
  set
    model_requested = coalesce(p_model_requested, false),
    model_requested_at =
      case
        when coalesce(p_model_requested, false) and not requested_before
          then now()
        when coalesce(p_model_requested, false)
          then model_requested_at
        else null
      end,
    model_requested_by_store_id =
      case
        when coalesce(p_model_requested, false) then store_id
        else null
      end,
    updated_at = now()
  where product_id = p_data->>'id'
    and store_ids = jsonb_build_array(store_id);

  if not found then
    raise exception using errcode='P0002', message='Product not found after save';
  end if;
end
$function$;
