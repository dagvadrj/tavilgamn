create or replace function public.merchant_dashboard_analytics(p_actor uuid)
returns jsonb
language plpgsql
stable
set search_path to ''
as $function$
declare
  target_store public.merchant_stores;
  period_start timestamptz := now() - interval '30 days';
  as_of timestamptz := now();
  result jsonb;
begin
  perform 1
  from public.profiles
  where id = p_actor
    and role = 'merchant';

  if not found then
    raise exception using
      errcode='42501',
      message='Merchant required';
  end if;

  select *
  into target_store
  from public.merchant_stores
  where owner_id = p_actor
    and active
  limit 1;

  if not found then
    return null;
  end if;

  with paid as (
    select f.*
    from public.merchant_order_fulfillments f
    where f.store_id = target_store.id
      and f.owner_id = p_actor
      and f.created_at >= period_start
      and f.created_at <= as_of
      and exists (
        select 1
        from public.order_payments p
        where p.order_id = f.order_id
          and p.state = 'paid'
      )
  ),
  sales as (
    select
      coalesce(sum(subtotal), 0)::bigint as gross_revenue,
      coalesce(sum(platform_fee), 0)::bigint as platform_fee,
      coalesce(sum(merchant_net), 0)::bigint as merchant_net,
      count(distinct order_id)::bigint as paid_orders
    from paid
  ),
  fulfillment_counts as (
    select
      count(*) filter (where status = 'pending')::bigint as pending_orders,
      count(*) filter (where status = 'processing')::bigint as processing_orders,
      count(*) filter (where status = 'shipped')::bigint as shipped_orders
    from public.merchant_order_fulfillments
    where store_id = target_store.id
      and owner_id = p_actor
  ),
  products as (
    select
      count(*)::bigint as product_count,
      coalesce(sum(in_stock), 0)::bigint as total_stock,
      count(*) filter (where in_stock <= 5)::bigint as low_stock_count,
      count(*) filter (where model_requested)::bigint as model_request_count
    from public.furniture_models
    where store_ids = jsonb_build_array(target_store.id)
  )
  select jsonb_build_object(
    'periodStart', period_start,
    'asOf', as_of,
    'storeId', target_store.id,
    'storeName', target_store.name,
    'commissionBps', target_store.commission_bps,
    'grossRevenue', sales.gross_revenue::text,
    'platformFee', sales.platform_fee::text,
    'merchantNet', sales.merchant_net::text,
    'paidOrders', sales.paid_orders::text,
    'pendingOrders', fulfillment_counts.pending_orders::text,
    'processingOrders', fulfillment_counts.processing_orders::text,
    'shippedOrders', fulfillment_counts.shipped_orders::text,
    'productCount', products.product_count::text,
    'totalStock', products.total_stock::text,
    'lowStockCount', products.low_stock_count::text,
    'modelRequestCount', products.model_request_count::text
  )
  into result
  from sales, fulfillment_counts, products;

  return result;
end
$function$;
