-- Phase 5: immutable checkout, operational audit and explicit cancellation/refund.
-- Supabase CLI is unavailable on the task host; filename reserved by coordinator.
begin;

alter table public.order_payments add column requires_review boolean not null default false;
alter table public.orders add column platform_fulfillment_status text
  check(platform_fulfillment_status in ('pending','processing','shipped','delivered'));

create table public.order_cancellations (
  order_id uuid primary key references public.orders(id) on delete restrict,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  reason text not null check(char_length(reason) between 5 and 1000),
  status text not null default 'requested' check(status in ('requested','approved','rejected','refunded')),
  requested_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id) on delete restrict,
  reviewed_at timestamptz,
  review_note text,
  refund_method text check(refund_method in ('qpay','socialpay','bank_transfer')),
  refund_reference text check(char_length(refund_reference) between 3 and 100),
  refund_amount bigint check(refund_amount>0),
  refunded_at timestamptz,
  check(status<>'refunded' or (refund_reference is not null and refund_amount is not null and refunded_at is not null and reviewed_by is not null)),
  unique(refund_method,refund_reference)
);
create index order_cancellations_status_requested_idx on public.order_cancellations(status,requested_at desc);
create index order_cancellations_requested_by_idx on public.order_cancellations(requested_by);
create index order_cancellations_reviewed_by_idx on public.order_cancellations(reviewed_by);
alter table public.order_cancellations enable row level security;
revoke all on public.order_cancellations from public,anon,authenticated;
grant all on public.order_cancellations to service_role;

create table public.commerce_order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  actor_id uuid references public.profiles(id) on delete restrict,
  event text not null check(event in ('payment_verified','late_payment_review','cancellation_requested','cancellation_approved','cancellation_rejected','refund_recorded','merchant_fulfillment','platform_fulfillment')),
  details jsonb not null default '{}'::jsonb check(jsonb_typeof(details)='object'),
  created_at timestamptz not null default now()
);
create index commerce_order_events_order_created_idx on public.commerce_order_events(order_id,created_at desc,id desc);
create index commerce_order_events_actor_idx on public.commerce_order_events(actor_id);
alter table public.commerce_order_events enable row level security;
revoke all on public.commerce_order_events from public,anon,authenticated;
grant select,insert on public.commerce_order_events to service_role;

create function public.protect_commerce_order_event() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  raise exception using errcode='42501',message='Commerce order events are append-only';
end $$;
create trigger protect_commerce_order_event before update or delete on public.commerce_order_events
for each row execute function public.protect_commerce_order_event();

create function public.protect_order_financial_snapshot() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='DELETE' then raise exception using errcode='42501',message='Orders are retained for audit'; end if;
  if row(new.id,new.user_id,new.idempotency_key,new.request_hash,new.currency,new.items,new.delivery,new.subtotal,new.shipping,new.total,new.created_at)
    is distinct from row(old.id,old.user_id,old.idempotency_key,old.request_hash,old.currency,old.items,old.delivery,old.subtotal,old.shipping,old.total,old.created_at) then
    raise exception using errcode='42501',message='Order identity and checkout snapshot are immutable';
  end if;
  if new.status='cancelled' and old.status<>'cancelled' then
    if old.status in ('shipped','delivered') or exists(select 1 from public.merchant_order_fulfillments f where f.order_id=old.id and f.status in ('shipped','delivered'))
      or old.platform_fulfillment_status in ('shipped','delivered') then
      raise exception using errcode='P0016',message='Shipped orders require a separate return workflow';
    end if;
    if not exists(select 1 from public.order_cancellations c where c.order_id=old.id and c.status in ('approved','refunded')) then
      raise exception using errcode='P0016',message='Cancellation approval required';
    end if;
  end if;
  return new;
end $$;
create trigger protect_order_financial_snapshot before update or delete on public.orders
for each row execute function public.protect_order_financial_snapshot();

create function public.validate_order_checkout_snapshot() returns trigger
language plpgsql security invoker set search_path='' as $$
declare line jsonb; calculated bigint:=0;
begin
  for line in select value from jsonb_array_elements(new.items) loop
    if jsonb_typeof(line->'qty') is distinct from 'number' or line->>'qty' !~ '^[0-9]+$'
      or (line->>'qty')::numeric not between 1 and 99
      or jsonb_typeof(line->'unitPrice') is distinct from 'number' or line->>'unitPrice' !~ '^[0-9]+$'
      or (line->>'unitPrice')::numeric>9007199254740991
      or jsonb_typeof(line->'lineTotal') is distinct from 'number' or line->>'lineTotal' !~ '^[0-9]+$'
      or (line->>'lineTotal')::numeric is distinct from (line->>'qty')::numeric*(line->>'unitPrice')::numeric then
      raise exception using errcode='22023',message='Invalid immutable order line calculation';
    end if;
    calculated:=calculated+(line->>'lineTotal')::bigint;
  end loop;
  if new.subtotal<>calculated then raise exception using errcode='22023',message='Order subtotal must equal snapshot lines'; end if;
  return new;
end $$;
create trigger validate_order_checkout_snapshot before insert on public.orders
for each row execute function public.validate_order_checkout_snapshot();

create function public.protect_order_cancellation_snapshot() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='DELETE' then raise exception using errcode='42501',message='Cancellation records are retained'; end if;
  if row(new.order_id,new.requested_by,new.reason,new.requested_at) is distinct from row(old.order_id,old.requested_by,old.reason,old.requested_at) then
    raise exception using errcode='42501',message='Cancellation request snapshot is immutable';
  end if;
  if old.status='refunded' and new is distinct from old then
    raise exception using errcode='42501',message='Completed refund record is immutable';
  end if;
  return new;
end $$;
create trigger protect_order_cancellation_snapshot before update or delete on public.order_cancellations
for each row execute function public.protect_order_cancellation_snapshot();

-- Determine whether a platform-admin fulfillment batch is needed without inventing
-- ownership for historical lines. Existing merchant snapshots stay untouched.
update public.orders o set platform_fulfillment_status=case when o.status in ('processing','shipped','delivered') then o.status else 'pending' end
where jsonb_array_length(o.items)>(select coalesce(sum(jsonb_array_length(f.items)),0) from public.merchant_order_fulfillments f where f.order_id=o.id);
create function public.snapshot_platform_order_fulfillment() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if jsonb_array_length(new.items)>(select coalesce(sum(jsonb_array_length(f.items)),0) from public.merchant_order_fulfillments f where f.order_id=new.id) then
    update public.orders set platform_fulfillment_status='pending' where id=new.id;
  end if;
  return new;
end $$;
-- Alphabetically after snapshot_merchant_order (Postgres same-event trigger order).
create trigger zz_snapshot_platform_order_fulfillment after insert on public.orders
for each row execute function public.snapshot_platform_order_fulfillment();

create function public.sync_order_fulfillment_status(p_order uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare current_order public.orders; states text[]; next_status text;
begin
  select * into current_order from public.orders where id=p_order for update;
  if not found or current_order.status in ('pending_payment','cancelled') then return; end if;
  select array_agg(f.status order by f.store_id) into states from public.merchant_order_fulfillments f where f.order_id=p_order;
  if current_order.platform_fulfillment_status is not null then states:=array_append(states,current_order.platform_fulfillment_status); end if;
  if coalesce(cardinality(states),0)=0 then return; end if;
  next_status:=case when states <@ array['delivered'] then 'delivered'
    when states <@ array['shipped','delivered'] then 'shipped'
    when exists(select 1 from unnest(states) x where x<>'pending') then 'processing' else 'paid' end;
  if current_order.status<>next_status then update public.orders set status=next_status where id=p_order; end if;
end $$;

create or replace function public.confirm_order_payment(p_order_id uuid,p_method text,p_reference text,p_amount bigint,p_verified_by uuid default null)
returns void language plpgsql security invoker set search_path='' as $$
declare payment public.order_payments; target public.orders; late boolean;
begin
  -- Order -> payment is shared by invoice claiming/cancel/review: no reversed locks.
  select * into target from public.orders where id=p_order_id for update;
  if not found or target.total<>p_amount or target.currency<>'MNT' then raise exception using errcode='P0016',message='Payment amount mismatch'; end if;
  select * into payment from public.order_payments where order_id=p_order_id for update;
  if not found or payment.method<>p_method then raise exception using errcode='P0016',message='Payment method mismatch'; end if;
  if p_reference is null or char_length(trim(p_reference)) not between 1 and 100 then raise exception using errcode='22023',message='Invalid payment reference'; end if;
  if p_method='bank_transfer' then
    perform 1 from public.profiles where id=p_verified_by and role='admin' for share;
    if not found then raise exception using errcode='42501',message='Fresh admin verification required'; end if;
  elsif p_verified_by is not null then raise exception using errcode='22023',message='Provider settlement has no manual actor'; end if;
  if payment.state='paid' then
    if payment.provider_reference is distinct from p_reference then raise exception using errcode='P0016',message='Payment reference mismatch'; end if;
    return;
  end if;
  late:=target.status='cancelled';
  if target.status<>'pending_payment' and not late then raise exception using errcode='P0016',message='Order is not payable'; end if;
  update public.order_payments set state='paid',provider_reference=p_reference,paid_at=now(),verified_by=p_verified_by,requires_review=late where order_id=p_order_id;
  if not late then update public.orders set status='paid' where id=p_order_id; end if;
  insert into public.commerce_order_events(order_id,actor_id,event,details) values(p_order_id,p_verified_by,
    case when late then 'late_payment_review' else 'payment_verified' end,jsonb_build_object('method',p_method,'amount',p_amount,'reference',p_reference));
end $$;

create function public.claim_order_payment(p_actor uuid,p_order uuid,p_method text,p_callback_token text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare target public.orders; payment public.order_payments; claimed boolean:=false;
begin
  if p_method not in ('qpay','socialpay','bank_transfer') or p_method is null or p_callback_token !~ '^[0-9a-f]{64}$' or p_callback_token is null then
    raise exception using errcode='22023',message='Invalid payment claim';
  end if;
  select * into target from public.orders where id=p_order and user_id=p_actor for update;
  if not found then raise exception using errcode='P0002',message='Order not found'; end if;
  if target.status<>'pending_payment' or exists(select 1 from public.order_cancellations c where c.order_id=p_order and c.status<>'rejected') then
    raise exception using errcode='P0016',message='Order cancellation or state blocks invoice creation';
  end if;
  select * into payment from public.order_payments where order_id=p_order;
  if not found then
    insert into public.order_payments(order_id,method,callback_token) values(p_order,p_method,p_callback_token) returning * into payment;
    claimed:=true;
  end if;
  return jsonb_build_object('claimed',claimed,'payment',jsonb_build_object('method',payment.method,'state',payment.state,'instructions',payment.instructions,'created_at',payment.created_at));
end $$;

create function public.request_order_cancellation(p_actor uuid,p_order uuid,p_reason text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare target public.orders; cancellation public.order_cancellations; automatic boolean;
begin
  if p_reason is null or char_length(trim(p_reason)) not between 5 and 1000 then raise exception using errcode='22023',message='Invalid cancellation reason'; end if;
  select * into target from public.orders where id=p_order and user_id=p_actor for update;
  if not found then raise exception using errcode='P0002',message='Order not found'; end if;
  select * into cancellation from public.order_cancellations where order_id=p_order;
  if found then return jsonb_build_object('cancellation',to_jsonb(cancellation),'orderStatus',target.status); end if;
  if target.status in ('cancelled','shipped','delivered') or target.platform_fulfillment_status in ('shipped','delivered')
    or exists(select 1 from public.merchant_order_fulfillments f where f.order_id=p_order and f.status in ('shipped','delivered')) then
    raise exception using errcode='P0016',message='Shipped orders require a separate return workflow';
  end if;
  automatic:=target.status='pending_payment' and not exists(select 1 from public.order_payments where order_id=p_order);
  insert into public.order_cancellations(order_id,requested_by,reason,status,review_note,reviewed_at)
    values(p_order,p_actor,trim(p_reason),case when automatic then 'approved' else 'requested' end,
      case when automatic then 'Төлбөрийн нэхэмжлэх үүсээгүй захиалгыг автоматаар цуцлав.' else null end,case when automatic then now() else null end)
    returning * into cancellation;
  if automatic then update public.orders set status='cancelled' where id=p_order; end if;
  insert into public.commerce_order_events(order_id,actor_id,event,details) values(p_order,p_actor,'cancellation_requested',jsonb_build_object('automatic',automatic,'reason',trim(p_reason)));
  if automatic then insert into public.commerce_order_events(order_id,actor_id,event,details) values(p_order,p_actor,'cancellation_approved',jsonb_build_object('automatic',true)); end if;
  return jsonb_build_object('cancellation',to_jsonb(cancellation),'orderStatus',case when automatic then 'cancelled' else target.status end);
end $$;

create function public.resolve_order_cancellation(p_actor uuid,p_order uuid,p_action text,p_note text,p_reference text default null,p_amount bigint default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare target public.orders; cancellation public.order_cancellations; payment public.order_payments;
begin
  perform 1 from public.profiles where id=p_actor and role='admin' for share;
  if not found then raise exception using errcode='42501',message='Admin required'; end if;
  if p_action not in ('approve','reject','record_refund') or p_action is null or p_note is null or char_length(trim(p_note)) not between 5 and 1000 then
    raise exception using errcode='22023',message='Invalid cancellation review';
  end if;
  select * into target from public.orders where id=p_order for update;
  if not found then raise exception using errcode='P0002',message='Order not found'; end if;
  select * into payment from public.order_payments where order_id=p_order for update;
  select * into cancellation from public.order_cancellations where order_id=p_order for update;
  if not found then raise exception using errcode='P0002',message='Cancellation not found'; end if;
  if (p_action='approve' and cancellation.status='approved') or (p_action='reject' and cancellation.status='rejected') then
    return jsonb_build_object('cancellation',to_jsonb(cancellation),'orderStatus',target.status);
  end if;
  if p_action='record_refund' then
    if cancellation.status='refunded' then
      if cancellation.refund_reference is distinct from trim(p_reference) or cancellation.refund_amount is distinct from p_amount then raise exception using errcode='P0016',message='Refund already recorded differently'; end if;
      return jsonb_build_object('cancellation',to_jsonb(cancellation),'orderStatus',target.status);
    end if;
    if cancellation.status<>'approved' or target.status<>'cancelled' or payment.state is distinct from 'paid' or p_amount is distinct from target.total
      or p_reference is null or char_length(trim(p_reference)) not between 3 and 100 then raise exception using errcode='P0016',message='Verified full external refund required'; end if;
    update public.order_cancellations set status='refunded',reviewed_by=p_actor,reviewed_at=now(),review_note=trim(p_note),refund_method=payment.method,
      refund_reference=trim(p_reference),refund_amount=p_amount,refunded_at=now() where order_id=p_order returning * into cancellation;
    update public.order_payments set requires_review=false where order_id=p_order;
    insert into public.commerce_order_events(order_id,actor_id,event,details) values(p_order,p_actor,'refund_recorded',jsonb_build_object('amount',p_amount,'reference',trim(p_reference),'method',payment.method,'note',trim(p_note)));
  else
    if cancellation.status<>'requested' or target.status in ('cancelled','shipped','delivered') or target.platform_fulfillment_status in ('shipped','delivered')
      or exists(select 1 from public.merchant_order_fulfillments f where f.order_id=p_order and f.status in ('shipped','delivered')) then
      raise exception using errcode='P0016',message='Cancellation cannot be resolved in current fulfillment state';
    end if;
    if p_action='approve' and payment.state='creating' then raise exception using errcode='P0016',message='Wait for invoice creation/reconcile uncertain invoice first'; end if;
    update public.order_cancellations set status=case when p_action='approve' then 'approved' else 'rejected' end,reviewed_by=p_actor,reviewed_at=now(),review_note=trim(p_note)
      where order_id=p_order returning * into cancellation;
    if p_action='approve' then
      update public.orders set status='cancelled' where id=p_order;
      if payment.state='paid' then update public.order_payments set requires_review=true where order_id=p_order; end if;
    end if;
    insert into public.commerce_order_events(order_id,actor_id,event,details) values(p_order,p_actor,
      case when p_action='approve' then 'cancellation_approved' else 'cancellation_rejected' end,jsonb_build_object('note',trim(p_note),'refundRequired',payment.state='paid'));
  end if;
  return jsonb_build_object('cancellation',to_jsonb(cancellation),'orderStatus',case when p_action='reject' then target.status else 'cancelled' end);
end $$;

create or replace function public.update_merchant_order(p_actor uuid,p_order uuid,p_status text,p_expected_status text) returns void
language plpgsql security invoker set search_path='' as $$
declare target_store_id text; order_status text; current_status text;
begin
  perform 1 from public.profiles where id=p_actor and role='merchant' for share;
  if not found then raise exception using errcode='42501',message='Merchant required'; end if;
  select id into target_store_id from public.merchant_stores where owner_id=p_actor and active for share;
  if not found then raise exception using errcode='42501',message='Active store required'; end if;
  if not exists(select 1 from public.merchant_order_fulfillments f where f.order_id=p_order and f.store_id=target_store_id and f.owner_id=p_actor) then
    raise exception using errcode='P0002',message='Order not found';
  end if;
  select status into order_status from public.orders where id=p_order for update;
  if order_status is null or order_status in ('pending_payment','cancelled') or exists(select 1 from public.order_cancellations c where c.order_id=p_order and c.status='requested') then
    raise exception using errcode='P0009',message='Order not ready for fulfillment';
  end if;
  select f.status into current_status from public.merchant_order_fulfillments f where f.order_id=p_order and f.store_id=target_store_id and f.owner_id=p_actor for update;
  if current_status is distinct from p_expected_status or p_status is null or p_status is distinct from
    (case current_status when 'pending' then 'processing' when 'processing' then 'shipped' when 'shipped' then 'delivered' else null end) then
    raise exception using errcode='P0009',message='Invalid or stale fulfillment transition';
  end if;
  update public.merchant_order_fulfillments f set status=p_status,updated_at=now() where f.order_id=p_order and f.store_id=target_store_id and f.owner_id=p_actor;
  perform public.sync_order_fulfillment_status(p_order);
  insert into public.commerce_order_events(order_id,actor_id,event,details) values(p_order,p_actor,'merchant_fulfillment',jsonb_build_object('storeId',target_store_id,'from',current_status,'to',p_status));
end $$;

create function public.update_platform_order(p_actor uuid,p_order uuid,p_status text,p_expected_status text) returns void
language plpgsql security invoker set search_path='' as $$
declare target public.orders;
begin
  perform 1 from public.profiles where id=p_actor and role='admin' for share;
  if not found then raise exception using errcode='42501',message='Admin required'; end if;
  select * into target from public.orders where id=p_order for update;
  if not found then raise exception using errcode='P0002',message='Order not found'; end if;
  if target.status in ('pending_payment','cancelled') or exists(select 1 from public.order_cancellations c where c.order_id=p_order and c.status='requested')
    or target.platform_fulfillment_status is null or target.platform_fulfillment_status is distinct from p_expected_status or p_status is null
    or p_status is distinct from (case target.platform_fulfillment_status when 'pending' then 'processing' when 'processing' then 'shipped' when 'shipped' then 'delivered' else null end) then
    raise exception using errcode='P0016',message='Invalid or stale platform fulfillment transition';
  end if;
  update public.orders set platform_fulfillment_status=p_status where id=p_order;
  perform public.sync_order_fulfillment_status(p_order);
  insert into public.commerce_order_events(order_id,actor_id,event,details) values(p_order,p_actor,'platform_fulfillment',jsonb_build_object('from',target.platform_fulfillment_status,'to',p_status));
end $$;

create or replace function public.read_merchant_orders(p_actor uuid,p_page integer default 0) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare target_store_id text; result jsonb;
begin
  if p_page is null or p_page<0 or p_page>100000 then raise exception using errcode='22023',message='Invalid page'; end if;
  perform 1 from public.profiles where id=p_actor and role='merchant' for share;
  if not found then raise exception using errcode='42501',message='Merchant required'; end if;
  select id into target_store_id from public.merchant_stores where owner_id=p_actor and active for share;
  if not found then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(page.row),'[]'::jsonb) into result from (
    select jsonb_build_object('id',f.order_id,'items',f.items,'subtotal',f.subtotal,'commissionBps',f.commission_bps,
      'platformFee',f.platform_fee,'merchantNet',f.merchant_net,'currency',o.currency,
      'delivery',jsonb_build_object('name',o.delivery->>'name','phone',o.delivery->>'phone','address',o.delivery->>'address'),
      'created_at',f.created_at,'status',f.status,'orderStatus',o.status,'cancellationStatus',c.status,
      'paymentStatus',case when o.status='cancelled' then 'cancelled' when o.status='pending_payment' then 'pending_payment' else 'paid' end) as row
    from public.merchant_order_fulfillments f join public.orders o on o.id=f.order_id
    left join public.order_cancellations c on c.order_id=o.id
    where f.owner_id=p_actor and f.store_id=target_store_id order by f.created_at desc,f.order_id desc offset p_page*20 limit 21
  ) page;
  return result;
end $$;

revoke all on function public.protect_commerce_order_event(),public.protect_order_financial_snapshot(),public.validate_order_checkout_snapshot(),public.protect_order_cancellation_snapshot(),
 public.snapshot_platform_order_fulfillment(),public.sync_order_fulfillment_status(uuid),public.confirm_order_payment(uuid,text,text,bigint,uuid),
 public.claim_order_payment(uuid,uuid,text,text),public.request_order_cancellation(uuid,uuid,text),public.resolve_order_cancellation(uuid,uuid,text,text,text,bigint),
 public.update_platform_order(uuid,uuid,text,text),public.update_merchant_order(uuid,uuid,text,text),public.read_merchant_orders(uuid,integer) from public,anon,authenticated;
grant execute on function public.protect_commerce_order_event(),public.protect_order_financial_snapshot(),public.validate_order_checkout_snapshot(),public.protect_order_cancellation_snapshot(),
 public.snapshot_platform_order_fulfillment(),public.sync_order_fulfillment_status(uuid),public.confirm_order_payment(uuid,text,text,bigint,uuid),
 public.claim_order_payment(uuid,uuid,text,text),public.request_order_cancellation(uuid,uuid,text),public.resolve_order_cancellation(uuid,uuid,text,text,text,bigint),
 public.update_platform_order(uuid,uuid,text,text),public.update_merchant_order(uuid,uuid,text,text),public.read_merchant_orders(uuid,integer) to service_role;

notify pgrst,'reload schema';
commit;
