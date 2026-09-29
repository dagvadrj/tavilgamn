begin;

create function public.admin_order_analytics()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with period as (
    select
      statement_timestamp() as until_at,
      statement_timestamp() - interval '720 hours' as since_at
  ),
  received as (
    select
      count(*)::text as payment_count,
      coalesce(sum(o.total), 0)::text as gross_received
    from public.order_payments p
    join public.orders o on o.id = p.order_id
    cross join period w
    where p.state = 'paid'
      and o.currency = 'MNT'
      and p.paid_at >= w.since_at
      and p.paid_at < w.until_at
  )
  select jsonb_build_object(
    'periodStart', w.since_at,
    'asOf', w.until_at,
    'ordersCreated', (
      select count(*)::text
      from public.orders o
      where o.created_at >= w.since_at
        and o.created_at < w.until_at
    ),
    'paymentsReceived', r.payment_count,
    'grossReceived', r.gross_received,
    'pendingOrders', (
      select count(*)::text
      from public.orders o
      where o.status = 'pending_payment'
        and o.created_at < w.until_at
    )
  )
  from period w
  cross join received r;
$$;

revoke all on function public.admin_order_analytics()
  from public, anon, authenticated;

grant execute on function public.admin_order_analytics()
  to service_role;

create index order_payments_paid_at_idx
  on public.order_payments (paid_at)
  where state = 'paid';

commit;