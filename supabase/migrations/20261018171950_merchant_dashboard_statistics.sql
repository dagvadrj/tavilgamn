-- Small independent dashboard reads; no customer addresses, GLBs or product media.
create function public.merchant_dashboard_progress(p_actor uuid,p_date date default null,p_page integer default 0) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare target_store text; result jsonb; selected_day date := coalesce(p_date,(now() at time zone 'Asia/Ulaanbaatar')::date);
begin
  target_store := public.merchant_delivery_store(p_actor);
  if p_page is null or p_page<0 or p_page>100000 then raise exception using errcode='22023',message='Invalid page'; end if;
  with matched as materialized (
    select f.order_id,f.delivery_stage,f.created_at,f.updated_at,f.subtotal,
      o.delivery->>'name' customer_name,o.status order_status,c.status cancellation_status,f.merchant_net,
      exists(select 1 from public.order_payments p where p.order_id=f.order_id and p.state='paid') payment_verified,
      case f.delivery_stage when 'incoming' then 0 when 'preparing' then 20 when 'prepared' then 40 when 'shipped' then 60 when 'delivered' then 80 else 100 end progress
    from public.merchant_order_fulfillments f join public.orders o on o.id=f.order_id
    left join public.order_cancellations c on c.order_id=o.id
    where f.owner_id=p_actor and f.store_id=target_store and o.status<>'cancelled'
  ), selected as (
    select * from matched where created_at>=selected_day::timestamp at time zone 'Asia/Ulaanbaatar' and created_at<(selected_day+1)::timestamp at time zone 'Asia/Ulaanbaatar'
  ), active as (
    select s.*,f.items from selected s join public.merchant_order_fulfillments f on f.order_id=s.order_id and f.owner_id=p_actor and f.store_id=target_store order by s.progress desc,s.created_at,s.order_id limit 20 offset p_page*20
  ) select jsonb_build_object('asOf',now(),
    'dayTotals',(select jsonb_build_object('orders',count(*),'paidOrders',count(*) filter(where payment_verified),'gross',coalesce(sum(subtotal) filter(where payment_verified),0)::text,'net',coalesce(sum(merchant_net) filter(where payment_verified),0)::text,'completed',count(*) filter(where delivery_stage='completed')) from selected),
    'selectedDate',selected_day,'total',(select count(*) from selected),'hasMore',(select count(*) from selected)>(p_page+1)*20,
    'dates',(select jsonb_agg(jsonb_build_object('date',d.day::date,'count',(select count(*) from matched m where (m.created_at at time zone 'Asia/Ulaanbaatar')::date=d.day::date),'gross',(select coalesce(sum(subtotal) filter(where payment_verified),0)::text from matched m where (m.created_at at time zone 'Asia/Ulaanbaatar')::date=d.day::date),'net',(select coalesce(sum(merchant_net) filter(where payment_verified),0)::text from matched m where (m.created_at at time zone 'Asia/Ulaanbaatar')::date=d.day::date),'completed',(select count(*) from matched m where (m.created_at at time zone 'Asia/Ulaanbaatar')::date=d.day::date and delivery_stage='completed')) order by d.day desc) from generate_series(selected_day::timestamp-interval '13 days',selected_day::timestamp,interval '1 day') d(day)),
    'counts',(select jsonb_object_agg(s.stage,(select count(*) from matched m where m.delivery_stage=s.stage)) from unnest(array['incoming','preparing','prepared','shipped','delivered','completed']) s(stage)),
    'held',(select count(*) from matched where order_status='pending_payment' or cancellation_status='requested'),
    'aging',(select jsonb_build_array(count(*) filter(where created_at>=now()-interval '1 day'),count(*) filter(where created_at<now()-interval '1 day' and created_at>=now()-interval '3 days'),count(*) filter(where created_at<now()-interval '3 days' and created_at>=now()-interval '7 days'),count(*) filter(where created_at<now()-interval '7 days')) from matched where delivery_stage<>'completed'),
    'orders',coalesce((select jsonb_agg(jsonb_build_object('id',order_id,'stage',delivery_stage,'progress',progress,'createdAt',created_at,'updatedAt',updated_at,'customer',customer_name,'subtotal',subtotal::text,
      'title',coalesce(items->0->>'name','Захиалга'),'itemCount',jsonb_array_length(items),'held',coalesce(cancellation_status='requested',false) or order_status='pending_payment') order by progress desc,created_at,order_id) from active),'[]'::jsonb)
  ) into result;
  return result;
end $$;

create function public.merchant_dashboard_trends(p_actor uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare target_store text; result jsonb; first_month timestamptz := date_trunc('month',now() at time zone 'Asia/Ulaanbaatar') at time zone 'Asia/Ulaanbaatar' - interval '5 months';
begin
  target_store := public.merchant_delivery_store(p_actor);
  with months as (select generate_series(0,5) n), paid as (
    select date_trunc('month',f.created_at at time zone 'Asia/Ulaanbaatar') as month_key,
      sum(f.subtotal)::text gross,sum(f.merchant_net)::text net,count(*) orders
    from public.merchant_order_fulfillments f
    where f.owner_id=p_actor and f.store_id=target_store and f.created_at>=first_month and f.created_at<=now()
      and exists(select 1 from public.order_payments p where p.order_id=f.order_id and p.state='paid')
    group by 1
  ) select jsonb_build_object('asOf',now(),'months',jsonb_agg(jsonb_build_object(
    'month',to_char((first_month at time zone 'Asia/Ulaanbaatar')+m.n*interval '1 month','YYYY-MM'),
    'gross',coalesce(p.gross,'0'),'net',coalesce(p.net,'0'),'orders',coalesce(p.orders,0)) order by m.n)) into result
    from months m left join paid p on p.month_key=(first_month at time zone 'Asia/Ulaanbaatar')+m.n*interval '1 month';
  return result;
end $$;
revoke all on function public.merchant_dashboard_progress(uuid,date,integer),public.merchant_dashboard_trends(uuid) from public,anon,authenticated;
grant execute on function public.merchant_dashboard_progress(uuid,date,integer),public.merchant_dashboard_trends(uuid) to service_role;
notify pgrst,'reload schema';
