-- Delivery stages supplement, rather than replace, the existing four-state
-- fulfillment contract used by buyer history, cancellation and analytics.
create table public.merchant_delivery_staff (
  id uuid primary key default gen_random_uuid(),
  store_id text not null references public.merchant_stores(id) on delete restrict,
  owner_id uuid not null references auth.users(id) on delete restrict,
  name text not null check(char_length(trim(name)) between 2 and 100),
  phone text not null check(char_length(phone) between 8 and 24),
  vehicle text not null default '' check(char_length(vehicle)<=100),
  active boolean not null default true,
  version integer not null default 0 check(version>=0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index merchant_delivery_staff_store_idx on public.merchant_delivery_staff(store_id,active,name,id);
create index merchant_delivery_staff_owner_idx on public.merchant_delivery_staff(owner_id,id);
alter table public.merchant_delivery_staff enable row level security;
revoke all on public.merchant_delivery_staff from public,anon,authenticated;
grant select,insert,update on public.merchant_delivery_staff to service_role;

alter table public.merchant_order_fulfillments
  add column delivery_stage text not null default 'incoming' check(delivery_stage in ('incoming','preparing','prepared','shipped','delivered','completed')),
  add column delivery_version integer not null default 0 check(delivery_version>=0),
  add column delivery_driver_id uuid references public.merchant_delivery_staff(id) on delete restrict,
  add column delivery_driver_snapshot jsonb,
  add column delivery_completed_at timestamptz,
  add constraint merchant_delivery_driver_snapshot_check check(
    (delivery_driver_id is null and delivery_driver_snapshot is null) or
    (delivery_driver_id is not null and delivery_driver_snapshot is not null and jsonb_typeof(delivery_driver_snapshot)='object'));
update public.merchant_order_fulfillments set delivery_stage=case status
  when 'processing' then 'preparing' when 'shipped' then 'shipped' when 'delivered' then 'delivered' else 'incoming' end;
alter table public.merchant_order_fulfillments add constraint merchant_delivery_stage_status_check check(
  (status='pending' and delivery_stage='incoming') or (status='processing' and delivery_stage in ('preparing','prepared')) or
  (status='shipped' and delivery_stage='shipped') or (status='delivered' and delivery_stage in ('delivered','completed'))),
  add constraint merchant_delivery_completion_check check(delivery_stage<>'completed' or delivery_completed_at is not null);
create index merchant_delivery_stage_created_idx on public.merchant_order_fulfillments(owner_id,store_id,delivery_stage,created_at desc,order_id desc);
create index merchant_delivery_driver_idx on public.merchant_order_fulfillments(delivery_driver_id) where delivery_driver_id is not null;

-- The API verifies the bearer token; every RPC rechecks current role and store.
create function public.merchant_delivery_store(p_actor uuid) returns text
language plpgsql security invoker set search_path='' as $$
declare result text;
begin
  perform 1 from public.profiles where id=p_actor and role='merchant' for share;
  if not found then raise exception using errcode='42501',message='Merchant required'; end if;
  select id into result from public.merchant_stores where owner_id=p_actor and active for share;
  if not found then raise exception using errcode='42501',message='Active store required'; end if;
  return result;
end $$;

create function public.read_merchant_delivery_staff(p_actor uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare target_store text; result jsonb;
begin
  target_store:=public.merchant_delivery_store(p_actor);
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'phone',s.phone,'vehicle',s.vehicle,'active',s.active,'version',s.version)
    order by s.active desc,s.name,s.id),'[]'::jsonb) into result
    from public.merchant_delivery_staff s where s.store_id=target_store and s.owner_id=p_actor;
  return result;
end $$;

create function public.save_merchant_delivery_staff(p_actor uuid,p_id uuid,p_expected_version integer,p_name text,p_phone text,p_vehicle text,p_active boolean) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare target_store text; staff public.merchant_delivery_staff;
begin
  target_store:=public.merchant_delivery_store(p_actor);
  if p_name is null or char_length(trim(p_name)) not between 2 and 100 or p_phone is null or char_length(trim(p_phone)) not between 8 and 24
    or trim(p_phone)!~'^\+?[0-9 ()-]+$' or char_length(regexp_replace(p_phone,'[^0-9]','','g')) not between 8 and 15
    or p_vehicle is null or char_length(trim(p_vehicle))>100 or p_active is null then
    raise exception using errcode='22023',message='Invalid delivery staff';
  end if;
  if p_id is null then
    if p_expected_version is not null then raise exception using errcode='22023',message='Invalid initial version'; end if;
    insert into public.merchant_delivery_staff(store_id,owner_id,name,phone,vehicle,active)
      values(target_store,p_actor,trim(p_name),trim(p_phone),trim(p_vehicle),p_active) returning * into staff;
  else
    select * into staff from public.merchant_delivery_staff where id=p_id and store_id=target_store and owner_id=p_actor for update;
    if not found then raise exception using errcode='P0002',message='Delivery staff not found'; end if;
    if staff.version is distinct from p_expected_version then raise exception using errcode='P0020',message='Stale delivery staff'; end if;
    update public.merchant_delivery_staff set name=trim(p_name),phone=trim(p_phone),vehicle=trim(p_vehicle),active=p_active,version=version+1,updated_at=now()
      where id=staff.id returning * into staff;
  end if;
  return jsonb_build_object('id',staff.id,'name',staff.name,'phone',staff.phone,'vehicle',staff.vehicle,'active',staff.active,'version',staff.version);
end $$;

create function public.read_merchant_delivery_orders(p_actor uuid,p_stage text,p_page integer default 0) returns jsonb
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
      jsonb_build_object('name',v.delivery->>'name','phone',v.delivery->>'phone','address',v.delivery->>'address'),
      'stage',v.delivery_stage,'version',v.delivery_version,'driver',v.delivery_driver_snapshot,'createdAt',v.created_at,'updatedAt',v.updated_at,
      'completedAt',v.delivery_completed_at,'cancellationStatus',v.cancellation_status,
      'paymentStatus',case when v.order_status='pending_payment' then 'pending_payment' else 'paid' end) order by v.created_at desc,v.order_id desc) from visible v
  ),'[]'::jsonb)) into result;
  return result;
end $$;

create function public.move_merchant_delivery_order(p_actor uuid,p_order uuid,p_stage text,p_expected_version integer,p_driver uuid default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare target_store text; order_status text; target public.merchant_order_fulfillments; staff public.merchant_delivery_staff; next_status text; driver_snapshot jsonb;
begin
  target_store:=public.merchant_delivery_store(p_actor);
  if not exists(select 1 from public.merchant_order_fulfillments where order_id=p_order and store_id=target_store and owner_id=p_actor) then
    raise exception using errcode='P0002',message='Order not found';
  end if;
  -- Keep the existing commerce lock order: profile -> store -> order -> fulfillment.
  select status into order_status from public.orders where id=p_order for update;
  if order_status is null or order_status in ('pending_payment','cancelled') or exists(select 1 from public.order_cancellations where order_id=p_order and status='requested') then
    raise exception using errcode='P0009',message='Order not ready for fulfillment';
  end if;
  select * into target from public.merchant_order_fulfillments where order_id=p_order and store_id=target_store and owner_id=p_actor for update;
  if target.delivery_version is distinct from p_expected_version or p_stage is null or p_stage is distinct from
    (case target.delivery_stage when 'incoming' then 'preparing' when 'preparing' then 'prepared' when 'prepared' then 'shipped' when 'shipped' then 'delivered' when 'delivered' then 'completed' else null end) then
    raise exception using errcode='P0009',message='Invalid or stale delivery transition';
  end if;
  if p_stage='shipped' then
    select * into staff from public.merchant_delivery_staff where id=p_driver and store_id=target_store and owner_id=p_actor and active for share;
    if not found then raise exception using errcode='P0020',message='Active delivery staff required'; end if;
    driver_snapshot:=jsonb_build_object('id',staff.id,'name',staff.name,'phone',staff.phone,'vehicle',staff.vehicle);
  elsif p_driver is not null then raise exception using errcode='22023',message='Driver only assigned at dispatch';
  end if;
  next_status:=case p_stage when 'preparing' then 'processing' when 'prepared' then 'processing' when 'shipped' then 'shipped' else 'delivered' end;
  update public.merchant_order_fulfillments set delivery_stage=p_stage,delivery_version=delivery_version+1,status=next_status,updated_at=now(),
    delivery_driver_id=case when p_stage='shipped' then staff.id else delivery_driver_id end,
    delivery_driver_snapshot=case when p_stage='shipped' then driver_snapshot else delivery_driver_snapshot end,
    delivery_completed_at=case when p_stage='completed' then now() else delivery_completed_at end
    where order_id=p_order and store_id=target_store and owner_id=p_actor;
  perform public.sync_order_fulfillment_status(p_order);
  insert into public.commerce_order_events(order_id,actor_id,event,details) values(p_order,p_actor,'merchant_fulfillment',
    jsonb_build_object('storeId',target_store,'from',target.status,'to',next_status,'deliveryFrom',target.delivery_stage,'deliveryTo',p_stage,'driverId',case when p_stage='shipped' then staff.id else target.delivery_driver_id end));
  return jsonb_build_object('ok',true,'stage',p_stage,'version',target.delivery_version+1);
end $$;

-- Old clients may still start preparation or confirm delivery; they cannot skip
-- the prepared stage or dispatch furniture without assigning a worker.
create or replace function public.update_merchant_order(p_actor uuid,p_order uuid,p_status text,p_expected_status text) returns void
language plpgsql security invoker set search_path='' as $$
declare target_store text; target public.merchant_order_fulfillments;
begin
  target_store:=public.merchant_delivery_store(p_actor);
  if not exists(select 1 from public.merchant_order_fulfillments where order_id=p_order and store_id=target_store and owner_id=p_actor) then
    raise exception using errcode='P0002',message='Order not found';
  end if;
  perform 1 from public.orders where id=p_order for update;
  select * into target from public.merchant_order_fulfillments where order_id=p_order and store_id=target_store and owner_id=p_actor for update;
  if target.status is distinct from p_expected_status or p_status is null or
    not ((p_status='processing' and target.delivery_stage='incoming') or (p_status='delivered' and target.delivery_stage='shipped')) then
    raise exception using errcode='P0009',message='Use delivery board to prepare and assign staff before dispatch';
  end if;
  perform public.move_merchant_delivery_order(p_actor,p_order,case p_status when 'processing' then 'preparing' else 'delivered' end,target.delivery_version,null);
end $$;

revoke all on function public.merchant_delivery_store(uuid),public.read_merchant_delivery_staff(uuid),public.save_merchant_delivery_staff(uuid,uuid,integer,text,text,text,boolean),
  public.read_merchant_delivery_orders(uuid,text,integer),public.move_merchant_delivery_order(uuid,uuid,text,integer,uuid),public.update_merchant_order(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.merchant_delivery_store(uuid),public.read_merchant_delivery_staff(uuid),public.save_merchant_delivery_staff(uuid,uuid,integer,text,text,text,boolean),
  public.read_merchant_delivery_orders(uuid,text,integer),public.move_merchant_delivery_order(uuid,uuid,text,integer,uuid),public.update_merchant_order(uuid,uuid,text,text) to service_role;
notify pgrst,'reload schema';
