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
        'productCount', coalesce(products.product_count, 0)::text,
        'modelRequestCount', coalesce(products.model_request_count, 0)::text,
        'paidOrderCount', coalesce(sales.paid_order_count, 0)::text,
        'grossRevenue', coalesce(sales.gross_revenue, 0)::text,
        'platformRevenue', coalesce(sales.platform_revenue, 0)::text,
        'merchantNet', coalesce(sales.merchant_net, 0)::text
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
