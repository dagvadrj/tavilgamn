begin;
alter table public.furniture_models add column made_to_order boolean not null default false;

-- The physical reservation is independent of quantities promised for production.
create or replace function public.reserve_order_stock() returns trigger
language plpgsql security invoker set search_path='' as $$
declare selection record; furniture public.furniture_models; line jsonb; current_price bigint;
  reserved integer; remaining integer; take integer; result jsonb;
begin
  for selection in select x->>'productId' as id,sum((x->>'qty')::integer) as qty
    from jsonb_array_elements(new.items) x group by x->>'productId' order by x->>'productId'
  loop
    select * into furniture from public.furniture_models where product_id=selection.id for update;
    if not found or furniture.archived_at is not null or selection.qty<1 or
      (not furniture.made_to_order and coalesce(furniture.in_stock,0)<selection.qty) then
      raise exception using errcode='P0004',message='Insufficient stock';
    end if;
    reserved:=least(coalesce(furniture.in_stock,0),selection.qty); remaining:=reserved; result:='[]';
    for line in select x from jsonb_array_elements(new.items) x loop
      if line->>'productId'=selection.id then
        select furniture.base_price+coalesce((c->>'priceDelta')::bigint,0)+(m->>'priceDelta')::bigint into current_price
          from jsonb_array_elements(furniture.colors) c,jsonb_array_elements(furniture.materials) m
          where c->>'id'=line->>'color' and m->>'id'=line->>'material';
        if not found or current_price is distinct from (line->>'unitPrice')::bigint then
          raise exception using errcode='P0005',message='Catalog price changed'; end if;
        if (line->>'qty')::integer not between 1 and 99 then raise exception using errcode='22023',message='Invalid quantity'; end if;
        take:=least(remaining,(line->>'qty')::integer); remaining:=remaining-take;
        line:=line||jsonb_build_object('reservedQuantity',take,'madeToOrderQuantity',(line->>'qty')::integer-take,
          'productionDays',case when (line->>'qty')::integer>take then '7–14' else null end,
          'name',furniture.name,'image',furniture.image_url,
          'colorName',(select c->>'name' from jsonb_array_elements(furniture.colors) c where c->>'id'=line->>'color'),
          'materialName',(select m->>'name' from jsonb_array_elements(furniture.materials) m where m->>'id'=line->>'material'),
          'productCategory',furniture.category,'storeIds',furniture.store_ids,
          'dimensions',jsonb_build_object('w',furniture.dimensions_w,'d',furniture.dimensions_d,'h',furniture.dimensions_h),
          'deliveryTerms',furniture.delivery_terms,'compareAtPrice',furniture.compare_at_price,
          'promotionLabel',furniture.promotion_label,'promotionEndsAt',furniture.promotion_ends_at);
      end if;
      result:=result||jsonb_build_array(line);
    end loop;
    new.items:=result;
    update public.furniture_models set in_stock=coalesce(in_stock,0)-reserved,updated_at=now() where id=furniture.id;
  end loop;
  new.stock_reserved:=true; return new;
end $$;
create or replace function public.release_cancelled_order_stock() returns trigger
language plpgsql security invoker set search_path='' as $$
declare selection record;
begin
  if old.stock_reserved and new.items is distinct from old.items then raise exception 'Reserved items are immutable'; end if;
  if old.status='cancelled' and new.status<>'cancelled' then raise exception 'Cancelled orders cannot be reopened'; end if;
  new.stock_reserved:=old.stock_reserved;
  if old.stock_reserved and old.status<>'cancelled' and new.status='cancelled' then
    for selection in select x->>'productId' as id,sum(coalesce((x->>'reservedQuantity')::integer,(x->>'qty')::integer)) as qty
      from jsonb_array_elements(old.items) x group by x->>'productId' order by x->>'productId'
    loop update public.furniture_models set in_stock=coalesce(in_stock,0)+selection.qty,updated_at=now() where product_id=selection.id; end loop;
    new.stock_reserved:=false;
  end if;
  return new;
end $$;

create function public.merchant_product_policy(p_actor uuid,p_product text,p_enabled boolean,p_expected boolean) returns void
language plpgsql security invoker set search_path='' as $$
declare sid text; row public.furniture_models;
begin
  sid:=public.merchant_delivery_store(p_actor);
  select * into row from public.furniture_models where product_id=p_product and store_ids=jsonb_build_array(sid) and archived_at is null for update;
  if not found then raise exception using errcode='42501',message='Product not owned'; end if;
  if row.made_to_order is distinct from p_expected then raise exception using errcode='P0003',message='Policy changed'; end if;
  if p_enabled is null then raise exception using errcode='22023',message='Invalid policy'; end if;
  update public.furniture_models set made_to_order=p_enabled,updated_at=now() where id=row.id;
end $$;

-- Private evidence: never return the photo URL in public product/analytics reads.
create table public.merchant_delivery_evidence(
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id),
  store_id text not null references public.merchant_stores(id), actor_id uuid not null references public.profiles(id),
  storage_path text unique, legacy boolean not null default false, created_at timestamptz not null default now(),
  unique(order_id,store_id)
);
insert into public.merchant_delivery_evidence(order_id,store_id,actor_id,legacy) select order_id,store_id,owner_id,true from public.merchant_order_fulfillments where delivery_stage in ('delivered','completed');
alter table public.merchant_order_fulfillments add column assembly_team boolean not null default false;
create function public.delivery_evidence_access(p_actor uuid,p_order uuid) returns text
language plpgsql security invoker set search_path='' as $$
declare access jsonb; sid text; f public.merchant_order_fulfillments;
begin
  access:=public.merchant_workspace_access(p_actor); sid:=access->>'storeId';
  select * into f from public.merchant_order_fulfillments where order_id=p_order and store_id=sid;
  if not found or (access->>'role'<>'owner' and not exists(
    select 1 from public.merchant_members m where m.user_id=p_actor and m.store_id=sid and m.active and m.role='driver' and m.driver_id=f.delivery_driver_id))
    or f.delivery_stage<>'shipped' then raise exception using errcode='42501',message='Assigned delivery required'; end if;
  return sid;
end $$;
create function public.register_delivery_evidence(p_actor uuid,p_order uuid,p_path text) returns void
language plpgsql security invoker set search_path='' as $$
declare sid text;
begin
  sid:=public.delivery_evidence_access(p_actor,p_order);
  if p_path not like p_actor::text||'/'||sid||'/delivery/'||p_order::text||'/%' or not exists(
    select 1 from storage.objects where bucket_id='merchant-private' and name=p_path) then
    raise exception using errcode='22023',message='Owned delivery photo required'; end if;
  insert into public.merchant_delivery_evidence(order_id,store_id,actor_id,storage_path) values(p_order,sid,p_actor,p_path)
    on conflict(order_id,store_id) do update set storage_path=excluded.storage_path,actor_id=excluded.actor_id,created_at=now();
end $$;
create function public.require_delivery_evidence() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  -- Existing completed deliveries are grandfathered. New transitions require evidence.
  if new.delivery_stage is distinct from old.delivery_stage and new.delivery_stage in ('delivered','completed')
    and not exists(select 1 from public.merchant_delivery_evidence e where e.order_id=new.order_id and e.store_id=new.store_id and (storage_path is not null or legacy))
  then raise exception using errcode='P0024',message='Delivery photo required'; end if;
  return new;
end $$;
create trigger require_delivery_evidence before update on public.merchant_order_fulfillments for each row execute function public.require_delivery_evidence();
create function public.set_delivery_assembly(p_actor uuid,p_order uuid,p_expected integer,p_assembly boolean) returns void
language plpgsql security invoker set search_path='' as $$
declare sid text;
begin
  sid:=public.merchant_delivery_store(p_actor);
  perform 1 from public.orders where id=p_order for update;
  update public.merchant_order_fulfillments set assembly_team=p_assembly where order_id=p_order and store_id=sid and owner_id=p_actor
    and delivery_stage='prepared' and delivery_version=p_expected;
  if not found then raise exception using errcode='P0009',message='Stale dispatch'; end if;
end $$;

create table public.kitchen_quotation_documents(
  quote_id uuid primary key references public.kitchen_quote_requests(id), items jsonb not null,
  total bigint not null check(total>=0), note text not null default '', created_at timestamptz not null default now()
);
create table public.kitchen_measurement_appointments(
  quote_id uuid primary key references public.kitchen_quote_requests(id), store_id text not null references public.merchant_stores(id),
  engineer text not null check(length(engineer) between 2 and 100), starts_at timestamptz not null, ends_at timestamptz not null,
  status text not null default 'proposed' check(status in ('proposed','confirmed','declined')),
  version integer not null default 0, check(ends_at>starts_at and ends_at<=starts_at+interval '4 hours')
);
create index kitchen_measurement_calendar on public.kitchen_measurement_appointments(store_id,starts_at,ends_at) where status<>'declined';
create function public.kitchen_commerce(p_actor uuid,p_quote uuid,p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare q public.kitchen_quote_requests; sid text; item jsonb; total bigint:=0; qty numeric; price bigint; start_time timestamptz; end_time timestamptz; engineer_name text;
begin
  if p_action in ('publish','schedule') then sid:=public.merchant_delivery_store(p_actor); end if;
  select * into q from public.kitchen_quote_requests where id=p_quote for update;
  if not found or (q.customer_id<>p_actor and q.merchant_owner_id<>p_actor) then raise exception using errcode='42501',message='Quote access denied'; end if;
  if q.merchant_owner_id=p_actor then perform public.merchant_delivery_store(p_actor); end if;
  if p_action='publish' then
    if sid<>q.store_id or jsonb_typeof(p_data->'items')<>'array' or jsonb_array_length(p_data->'items') not between 1 and 50 then raise exception using errcode='22023',message='Invalid quotation'; end if;
    for item in select x from jsonb_array_elements(p_data->'items') x loop
      qty:=(item->>'quantity')::numeric; price:=(item->>'unitPrice')::bigint;
      if length(coalesce(item->>'name','')) not between 1 and 200 or qty is null or qty<=0 or qty>10000 or qty<>round(qty,2) or price is null or price<0 or price>1000000000 or length(coalesce(item->>'unit','')) not between 1 and 20 then raise exception using errcode='22023',message='Invalid quotation line'; end if;
      total:=total+round(qty*price)::bigint;
    end loop;
    if total>9007199254740991 then raise exception using errcode='22023',message='Quotation too large'; end if;
    perform public.update_merchant_kitchen_quote(p_actor,p_quote,'quoted',p_data->>'expectedStatus',total,coalesce(p_data->>'note',''));
    insert into public.kitchen_quotation_documents(quote_id,items,total,note) values(p_quote,p_data->'items',total,coalesce(p_data->>'note',''));
  elsif p_action='schedule' then
    start_time:=(p_data->>'startsAt')::timestamptz; end_time:=(p_data->>'endsAt')::timestamptz; engineer_name:=trim(p_data->>'engineer');
    if sid<>q.store_id or q.status='closed' or start_time is null or start_time<now() or end_time is null or end_time<=start_time or end_time>start_time+interval '4 hours' or length(coalesce(engineer_name,'')) not between 2 and 100 then raise exception using errcode='22023',message='Invalid appointment'; end if;
    -- Serialize the calendar without upgrading the store's shared ownership lock.
    perform pg_advisory_xact_lock(hashtextextended('measurement:'||sid,0));
    if exists(select 1 from public.kitchen_measurement_appointments a where a.store_id=sid and lower(a.engineer)=lower(engineer_name) and a.quote_id<>p_quote and a.status<>'declined' and a.starts_at<end_time and a.ends_at>start_time) then raise exception using errcode='P0003',message='Engineer is booked'; end if;
    if exists(select 1 from public.kitchen_measurement_appointments a where a.quote_id=p_quote and a.version is distinct from (p_data->>'version')::integer) then raise exception using errcode='P0003',message='Appointment changed'; end if;
    insert into public.kitchen_measurement_appointments(quote_id,store_id,engineer,starts_at,ends_at) values(p_quote,sid,engineer_name,start_time,end_time)
      on conflict(quote_id) do update set engineer=excluded.engineer,starts_at=excluded.starts_at,ends_at=excluded.ends_at,status='proposed',version=kitchen_measurement_appointments.version+1;
    insert into public.user_notifications(user_id,kind,title,body,href,entity_id,source_key,metadata) values(q.customer_id,'kitchen_quote','Хэмжилтийн цаг санал болголоо',engineer_name,'/account#kitchen-quotes',q.id,'measurement:'||q.id||':'||start_time,jsonb_build_object('quoteId',q.id)) on conflict(source_key) do nothing;
  elsif p_action='respond' then
    if q.customer_id<>p_actor or p_data->>'status' not in ('confirmed','declined') then raise exception using errcode='42501',message='Customer response required'; end if;
    update public.kitchen_measurement_appointments set status=p_data->>'status',version=version+1 where quote_id=p_quote and version=(p_data->>'version')::integer and starts_at>now() and status='proposed';
    if not found then raise exception using errcode='P0003',message='Appointment changed'; end if;
  elsif p_action<>'read' then raise exception using errcode='22023',message='Invalid action'; end if;
  return jsonb_build_object('projectName',q.project_name,'storeName',(select name from public.merchant_stores where id=q.store_id),
    'document',(select to_jsonb(d) from public.kitchen_quotation_documents d where d.quote_id=p_quote),
    'appointment',(select to_jsonb(a)-'store_id' from public.kitchen_measurement_appointments a where a.quote_id=p_quote));
end $$;

create table public.product_3d_events(
  id uuid primary key, session_id uuid not null, product_id text not null,
  kind text not null check(kind in ('placement','color','material')), option_id text not null default '',
  created_at timestamptz not null default now()
);
create index product_3d_events_product_time on public.product_3d_events(product_id,created_at desc);
create index product_3d_events_session_time on public.product_3d_events(session_id,created_at desc);
create function public.record_product_3d_event(p_id uuid,p_session uuid,p_product text,p_kind text,p_option text default '') returns void
language plpgsql security invoker set search_path='' as $$
declare product public.furniture_models;
begin
  select * into product from public.furniture_models where product_id=p_product and archived_at is null and glb_path is not null and processing_status='ready';
  if not found or p_kind not in ('placement','color','material') or p_kind is null or p_session is null or p_id is null then return; end if;
  if (p_kind='color' and not exists(select 1 from jsonb_array_elements(product.colors) c where c->>'id'=p_option)) or
    (p_kind='material' and not exists(select 1 from jsonb_array_elements(product.materials) c where c->>'id'=p_option)) then return; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_session::text,0));
  if (select count(*) from public.product_3d_events where session_id=p_session and created_at>now()-interval '1 hour')>=120 then return; end if;
  if exists(select 1 from public.product_3d_events where session_id=p_session and product_id=p_product and kind=p_kind and option_id=coalesce(p_option,'') and created_at>now()-interval '10 seconds') then return; end if;
  insert into public.product_3d_events(id,session_id,product_id,kind,option_id) values(p_id,p_session,p_product,p_kind,coalesce(p_option,'')) on conflict(id) do nothing;
end $$;
create function public.merchant_3d_insights(p_actor uuid,p_days integer default 7) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare sid text; result jsonb;
begin
  sid:=public.merchant_delivery_store(p_actor);
  if p_days is null or p_days not in (7,30,90) then raise exception using errcode='22023',message='Invalid period'; end if;
  with products as (select product_id,name,colors,materials from public.furniture_models where store_ids=jsonb_build_array(sid) and archived_at is null),
  events as (select e.* from public.product_3d_events e join products p on p.product_id=e.product_id where e.created_at>=date_trunc('day',now() at time zone 'Asia/Ulaanbaatar') at time zone 'Asia/Ulaanbaatar'-(p_days-1)*interval '1 day'),
  sales as (select x->>'productId' product_id,count(distinct f.order_id) orders from public.merchant_order_fulfillments f join public.orders o on o.id=f.order_id
    cross join lateral jsonb_array_elements(f.items) x where f.store_id=sid and o.status<>'cancelled' and f.created_at>=now()-p_days*interval '1 day'
    and exists(select 1 from public.order_payments pay where pay.order_id=o.id and pay.state='paid') group by x->>'productId')
  select jsonb_agg(jsonb_build_object('productId',p.product_id,'name',p.name,'placements',(select count(distinct session_id) from events where product_id=p.product_id and kind='placement'),
    'orders',coalesce(s.orders,0),'options',coalesce((select jsonb_agg(to_jsonb(d)) from (select kind,option_id,coalesce((select c->>'name' from jsonb_array_elements(case when kind='color' then p.colors else p.materials end) c where c->>'id'=option_id),option_id) label,count(distinct session_id) sessions from events where product_id=p.product_id and kind<>'placement' group by kind,option_id order by sessions desc limit 8) d),'[]')) order by (select count(*) from events where product_id=p.product_id and kind='placement') desc,p.product_id) into result from products p left join sales s on s.product_id=p.product_id;
  return jsonb_build_object('products',coalesce(result,'[]'));
end $$;

create or replace function public.read_merchant_delivery_orders(p_actor uuid,p_stage text,p_page integer default 0) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare target_store text; result jsonb;
begin
  target_store:=public.merchant_delivery_store(p_actor);
  if p_stage is null or p_stage not in ('incoming','preparing','prepared','shipped','delivered','completed') or p_page is null or p_page<0 or p_page>100000 then
    raise exception using errcode='22023',message='Invalid delivery page';
  end if;
  with matched as materialized (
    select f.order_id,f.created_at
    from public.merchant_order_fulfillments f join public.orders o on o.id=f.order_id
    where f.owner_id=p_actor and f.store_id=target_store and f.delivery_stage=p_stage and o.status<>'cancelled'
  ), page as (
    select * from matched order by created_at desc,order_id desc limit 21 offset p_page*20
  ), visible as (
    select f.*,o.delivery,o.status as order_status,c.status as cancellation_status
    from (select * from page order by created_at desc,order_id desc limit 20) p
      join public.merchant_order_fulfillments f on f.order_id=p.order_id and f.store_id=target_store and f.owner_id=p_actor
      join public.orders o on o.id=p.order_id left join public.order_cancellations c on c.order_id=o.id
  ) select jsonb_build_object('total',(select count(*) from matched),'hasMore',(select count(*)>20 from page),'orders',coalesce((
    select jsonb_agg(jsonb_build_object('id',v.order_id,'items',v.items,'subtotal',v.subtotal,'delivery',
      v.delivery,
      'stage',v.delivery_stage,'version',v.delivery_version,'driver',v.delivery_driver_snapshot,'assemblyTeam',v.assembly_team,'proofAvailable',exists(select 1 from public.merchant_delivery_evidence e where e.order_id=v.order_id and e.store_id=v.store_id and e.storage_path is not null),'createdAt',v.created_at,'updatedAt',v.updated_at,
      'completedAt',v.delivery_completed_at,'cancellationStatus',v.cancellation_status,
      'paymentStatus',case when v.order_status='pending_payment' then 'pending_payment' else 'paid' end) order by v.created_at desc,v.order_id desc) from visible v
  ),'[]'::jsonb)) into result;
  return result;
end $$;

create or replace function public.staff_delivery(p_actor uuid,p_action text,p_data jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare a jsonb; result jsonb; target public.merchant_order_fulfillments; stage text; page_no integer;
begin
  a:=public.merchant_workspace_access(p_actor);
  if a->>'role' not in ('driver','warehouse') then raise exception using errcode='42501',message='Delivery permission required'; end if;
  if p_action='staff' then return jsonb_build_object('staff','[]'::jsonb); end if;
  stage:=p_data->>'stage'; page_no:=coalesce((p_data->>'page')::integer,0);
  if p_action='read' then
    if stage not in ('incoming','preparing','prepared','shipped','delivered','completed') or page_no<0 or page_no>100000 then raise exception using errcode='22023',message='Invalid page'; end if;
    with matched as materialized (
      select f.*,o.delivery,o.status as order_status,c.status as cancellation_status from public.merchant_order_fulfillments f join public.orders o on o.id=f.order_id
      left join public.order_cancellations c on c.order_id=o.id where f.store_id=a->>'storeId' and f.delivery_stage=stage and o.status<>'cancelled'
      and ((a->>'role'='driver' and f.delivery_driver_id=(a->>'driverId')::uuid) or (a->>'role'='warehouse' and stage in ('incoming','preparing','prepared')))
    ), visible as (select * from matched order by created_at desc,order_id desc limit 20 offset page_no*20)
    select jsonb_build_object('total',(select count(*) from matched),'hasMore',(select count(*) from matched)>(page_no+1)*20,'orders',coalesce((select jsonb_agg(jsonb_build_object(
      'id',v.order_id,'items',v.items,'subtotal',v.subtotal,'delivery',v.delivery,'stage',v.delivery_stage,'version',v.delivery_version,'driver',v.delivery_driver_snapshot,'assemblyTeam',v.assembly_team,'proofAvailable',exists(select 1 from public.merchant_delivery_evidence e where e.order_id=v.order_id and e.store_id=v.store_id and e.storage_path is not null),
      'createdAt',v.created_at,'updatedAt',v.updated_at,'completedAt',v.delivery_completed_at,'cancellationStatus',v.cancellation_status,
      'paymentStatus',case when v.order_status='pending_payment' then 'pending_payment' else 'paid' end) order by v.created_at desc,v.order_id desc) from visible v),'[]')) into result;
    return result;
  elsif p_action='move' then
    -- Use the same order -> fulfillment lock order as the owner workflow.
    perform 1 from public.orders where id=(p_data->>'orderId')::uuid for update;
    select * into target from public.merchant_order_fulfillments where order_id=(p_data->>'orderId')::uuid and store_id=a->>'storeId' for update;
    if not found or not ((a->>'role'='driver' and target.delivery_driver_id=(a->>'driverId')::uuid and target.delivery_stage='shipped' and stage='delivered') or
      (a->>'role'='warehouse' and ((target.delivery_stage='incoming' and stage='preparing') or (target.delivery_stage='preparing' and stage='prepared')))) then
      raise exception using errcode='42501',message='Assigned delivery and permitted stage required'; end if;
    result:=public.move_merchant_delivery_order((a->>'ownerId')::uuid,target.order_id,stage,(p_data->>'expectedVersion')::integer,null);
    insert into public.merchant_operation_events(store_id,actor_id,action,details) values(a->>'storeId',p_actor,'staff_delivery',p_data);
    return result;
  end if;
  raise exception using errcode='22023',message='Unknown operation';
end $$;

create function public.move_showroom_delivery(p_actor uuid,p_data jsonb,p_staff boolean default false) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
  if p_staff then return public.staff_delivery(p_actor,'move',p_data); end if;
  if p_data->>'stage'='shipped' then
    perform public.set_delivery_assembly(p_actor,(p_data->>'orderId')::uuid,(p_data->>'expectedVersion')::integer,coalesce((p_data->>'assemblyTeam')::boolean,false));
  end if;
  return public.move_merchant_delivery_order(p_actor,(p_data->>'orderId')::uuid,p_data->>'stage',(p_data->>'expectedVersion')::integer,(p_data->>'driverId')::uuid);
end $$;
revoke all on function public.move_showroom_delivery(uuid,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.move_showroom_delivery(uuid,jsonb,boolean) to service_role;

-- All access is through authenticated, fresh-identity server routes.
alter table public.merchant_delivery_evidence enable row level security;
alter table public.kitchen_quotation_documents enable row level security;
alter table public.kitchen_measurement_appointments enable row level security;
alter table public.product_3d_events enable row level security;
revoke all on public.merchant_delivery_evidence,public.kitchen_quotation_documents,public.kitchen_measurement_appointments,public.product_3d_events from public,anon,authenticated;
grant all on public.merchant_delivery_evidence,public.kitchen_quotation_documents,public.kitchen_measurement_appointments,public.product_3d_events to service_role;
revoke all on function public.merchant_product_policy(uuid,text,boolean,boolean),public.delivery_evidence_access(uuid,uuid),public.register_delivery_evidence(uuid,uuid,text),public.require_delivery_evidence(),public.set_delivery_assembly(uuid,uuid,integer,boolean),public.kitchen_commerce(uuid,uuid,text,jsonb),public.record_product_3d_event(uuid,uuid,text,text,text),public.merchant_3d_insights(uuid,integer) from public,anon,authenticated;
grant execute on function public.merchant_product_policy(uuid,text,boolean,boolean),public.delivery_evidence_access(uuid,uuid),public.register_delivery_evidence(uuid,uuid,text),public.require_delivery_evidence(),public.set_delivery_assembly(uuid,uuid,integer,boolean),public.kitchen_commerce(uuid,uuid,text,jsonb),public.record_product_3d_event(uuid,uuid,text,text,text),public.merchant_3d_insights(uuid,integer) to service_role;
notify pgrst,'reload schema';
commit;
