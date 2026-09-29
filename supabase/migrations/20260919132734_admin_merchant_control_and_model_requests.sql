create or replace function public.admin_merchant_overview(p_actor uuid)
returns jsonb
language plpgsql
stable
set search_path to ''
as $function$
declare
  result jsonb;
begin
  perform 1
  from public.profiles
  where id = p_actor and role = 'admin';

  if not found then
    raise exception using errcode='42501', message='Admin required';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'ownerId', s.owner_id,
        'name', s.name,
        'storeType', s.store_type,
        'city', s.city,
        'district', s.district,
        'image', s.image,
        'active', s.active,
        'commissionBps', s.commission_bps,
        'isFeatured', s.is_featured,
        'featuredRank', s.featured_rank,
        'createdAt', s.created_at,
        'productCount', coalesce(products.product_count, 0),
        'modelRequestCount', coalesce(products.model_request_count, 0),
        'paidOrderCount', coalesce(sales.paid_order_count, 0),
        'grossRevenue', coalesce(sales.gross_revenue, 0),
        'platformRevenue', coalesce(sales.platform_revenue, 0),
        'merchantNet', coalesce(sales.merchant_net, 0)
      )
      order by
        coalesce(sales.gross_revenue, 0) desc,
        s.created_at asc
    ),
    '[]'::jsonb
  )
  into result
  from public.merchant_stores s
  left join lateral (
    select
      count(*)::bigint as product_count,
      count(*) filter (where m.model_requested)::bigint as model_request_count
    from public.furniture_models m
    where m.store_ids = jsonb_build_array(s.id)
  ) products on true
  left join lateral (
    select
      count(distinct f.order_id)::bigint as paid_order_count,
      coalesce(sum(f.subtotal), 0)::bigint as gross_revenue,
      coalesce(sum(f.platform_fee), 0)::bigint as platform_revenue,
      coalesce(sum(f.merchant_net), 0)::bigint as merchant_net
    from public.merchant_order_fulfillments f
    join public.order_payments p
      on p.order_id = f.order_id
     and p.state = 'paid'
    where f.store_id = s.id
  ) sales on true;

  return result;
end
$function$;

create or replace function public.admin_update_merchant_settings(
  p_actor uuid,
  p_store_id text,
  p_commission_bps integer,
  p_is_featured boolean,
  p_featured_rank integer,
  p_active boolean
)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  updated public.merchant_stores;
begin
  perform 1
  from public.profiles
  where id = p_actor and role = 'admin'
  for share;

  if not found then
    raise exception using errcode='42501', message='Admin required';
  end if;

  if p_commission_bps is null
     or p_commission_bps < 300
     or p_commission_bps > 500 then
    raise exception using errcode='22023', message='Commission must be between 3% and 5%';
  end if;

  if coalesce(p_is_featured, false)
     and (p_featured_rank is null or p_featured_rank < 1) then
    raise exception using errcode='22023', message='Featured rank required';
  end if;

  update public.merchant_stores
  set
    commission_bps = p_commission_bps,
    is_featured = coalesce(p_is_featured, false),
    featured_rank =
      case when coalesce(p_is_featured, false) then p_featured_rank else null end,
    featured_at =
      case
        when coalesce(p_is_featured, false) and not is_featured then now()
        when coalesce(p_is_featured, false) then featured_at
        else null
      end,
    active = coalesce(p_active, active),
    updated_at = now()
  where id = p_store_id
  returning * into updated;

  if not found then
    raise exception using errcode='P0002', message='Store not found';
  end if;

  return jsonb_build_object(
    'id', updated.id,
    'active', updated.active,
    'commissionBps', updated.commission_bps,
    'isFeatured', updated.is_featured,
    'featuredRank', updated.featured_rank
  );
end
$function$;

create or replace function public.admin_3d_model_requests(p_actor uuid)
returns jsonb
language plpgsql
stable
set search_path to ''
as $function$
declare
  result jsonb;
begin
  perform 1
  from public.profiles
  where id = p_actor and role = 'admin';

  if not found then
    raise exception using errcode='42501', message='Admin required';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
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
        'highPath', m.high_glb_path
      )
      order by m.model_requested_at asc nulls last, m.updated_at asc
    ),
    '[]'::jsonb
  )
  into result
  from public.furniture_models m
  left join public.merchant_stores s
    on s.id = m.model_requested_by_store_id
  where m.model_requested = true;

  return result;
end
$function$;

create index if not exists merchant_fulfillments_paid_lookup_idx
  on public.merchant_order_fulfillments (store_id, order_id);

create index if not exists merchant_stores_featured_rank_unique_idx
  on public.merchant_stores (featured_rank)
  where is_featured = true and featured_rank is not null;
