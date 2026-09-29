create or replace function public.admin_marketplace_analytics(p_actor uuid)
returns jsonb
language plpgsql
stable
set search_path to ''
as $function$
declare
  period_start timestamptz := now() - interval '30 days';
  as_of timestamptz := now();
  result jsonb;
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

  with paid_fulfillments as (
    select f.*
    from public.merchant_order_fulfillments f
    where f.created_at >= period_start
      and f.created_at <= as_of
      and exists (
        select 1
        from public.order_payments p
        where p.order_id = f.order_id
          and p.state = 'paid'
      )
  ),
  marketplace as (
    select
      coalesce(sum(f.subtotal), 0)::bigint as gmv,
      coalesce(sum(f.platform_fee), 0)::bigint as platform_revenue,
      coalesce(sum(f.merchant_net), 0)::bigint as merchant_net,
      count(distinct f.order_id)::bigint as paid_orders
    from paid_fulfillments f
  ),
  merchant_counts as (
    select
      count(*)::bigint as total_merchants,
      count(*) filter (where active)::bigint as active_merchants,
      count(*) filter (where active and is_featured)::bigint as featured_merchants
    from public.merchant_stores
  ),
  model_counts as (
    select
      count(*) filter (
        where model_requested
          and coalesce(processing_status, '') not in ('ready', 'completed')
      )::bigint as open_model_requests
    from public.furniture_models
  ),
  top_merchants as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', ranked.id,
          'name', ranked.name,
          'image', ranked.image,
          'commissionBps', ranked.commission_bps,
          'grossRevenue', ranked.gross_revenue::text,
          'platformRevenue', ranked.platform_revenue::text,
          'merchantNet', ranked.merchant_net::text,
          'orders', ranked.orders::text
        )
        order by ranked.gross_revenue desc, ranked.orders desc, ranked.name asc
      ),
      '[]'::jsonb
    ) as rows
    from (
      select
        s.id,
        s.name,
        s.image,
        s.commission_bps,
        coalesce(sum(f.subtotal), 0)::bigint as gross_revenue,
        coalesce(sum(f.platform_fee), 0)::bigint as platform_revenue,
        coalesce(sum(f.merchant_net), 0)::bigint as merchant_net,
        count(distinct f.order_id)::bigint as orders
      from public.merchant_stores s
      left join paid_fulfillments f
        on f.store_id = s.id
      where s.active
      group by
        s.id,
        s.name,
        s.image,
        s.commission_bps
      order by
        gross_revenue desc,
        orders desc,
        s.name asc
      limit 5
    ) ranked
  )
  select jsonb_build_object(
    'periodStart', period_start,
    'asOf', as_of,
    'gmv', marketplace.gmv::text,
    'platformRevenue', marketplace.platform_revenue::text,
    'merchantNet', marketplace.merchant_net::text,
    'paidOrders', marketplace.paid_orders::text,
    'totalMerchants', merchant_counts.total_merchants::text,
    'activeMerchants', merchant_counts.active_merchants::text,
    'featuredMerchants', merchant_counts.featured_merchants::text,
    'openModelRequests', model_counts.open_model_requests::text,
    'topMerchants', top_merchants.rows
  )
  into result
  from marketplace, merchant_counts, model_counts, top_merchants;

  return result;
end
$function$;
