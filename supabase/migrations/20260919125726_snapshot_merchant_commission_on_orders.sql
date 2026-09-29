create or replace function public.snapshot_merchant_order()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  line jsonb;
  stores jsonb;
  merchant public.merchant_stores;
begin
  for line in select value from jsonb_array_elements(new.items) loop
    select store_ids into stores
    from public.furniture_models
    where product_id = line->>'productId';

    if not exists(
      select 1
      from public.merchant_stores s
      where stores ? s.id
    ) then
      continue;
    end if;

    if jsonb_typeof(stores) is distinct from 'array'
       or jsonb_array_length(stores) <> 1 then
      raise exception using
        errcode='P0008',
        message='Ambiguous merchant ownership';
    end if;

    select s.* into merchant
    from public.merchant_stores s
    join public.profiles p on p.id = s.owner_id
    where s.id = stores->>0
      and s.active
      and p.role = 'merchant'
    for share of p, s nowait;

    if not found then
      raise exception using
        errcode='P0008',
        message='Merchant unavailable';
    end if;
  end loop;

  insert into public.merchant_order_fulfillments(
    order_id,
    store_id,
    owner_id,
    items,
    subtotal,
    commission_bps,
    created_at
  )
  select
    new.id,
    s.id,
    s.owner_id,
    jsonb_agg(x.line order by x.ordinal),
    sum((x.line->>'lineTotal')::bigint),
    s.commission_bps,
    new.created_at
  from jsonb_array_elements(new.items)
    with ordinality as x(line, ordinal)
  join public.furniture_models m
    on m.product_id = x.line->>'productId'
  join public.merchant_stores s
    on m.store_ids = jsonb_build_array(s.id)
  group by s.id, s.owner_id, s.commission_bps;

  return new;

exception
  when lock_not_available then
    raise exception using
      errcode='P0008',
      message='Merchant availability changed; retry checkout';
end
$function$;

create or replace function public.protect_merchant_order_snapshot()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if row(
      new.order_id,
      new.store_id,
      new.owner_id,
      new.items,
      new.subtotal,
      new.commission_bps,
      new.created_at
    )
    is distinct from
    row(
      old.order_id,
      old.store_id,
      old.owner_id,
      old.items,
      old.subtotal,
      old.commission_bps,
      old.created_at
    )
  then
    raise exception using
      errcode='42501',
      message='Order ownership, items and commission snapshot are immutable';
  end if;

  return new;
end
$function$;

create or replace function public.read_merchant_orders(
  p_actor uuid,
  p_page integer default 0
)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  target_store_id text;
  result jsonb;
begin
  if p_page is null or p_page < 0 or p_page > 100000 then
    raise exception using errcode='22023', message='Invalid page';
  end if;

  perform 1
  from public.profiles
  where id = p_actor and role = 'merchant'
  for share;

  if not found then
    raise exception using errcode='42501', message='Merchant required';
  end if;

  select id into target_store_id
  from public.merchant_stores
  where owner_id = p_actor and active
  for share;

  if not found then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(page.row), '[]'::jsonb)
  into result
  from (
    select jsonb_build_object(
      'id', f.order_id,
      'items', f.items,
      'subtotal', f.subtotal,
      'commissionBps', f.commission_bps,
      'platformFee', f.platform_fee,
      'merchantNet', f.merchant_net,
      'currency', o.currency,
      'delivery', jsonb_build_object(
        'name', o.delivery->>'name',
        'phone', o.delivery->>'phone',
        'address', o.delivery->>'address'
      ),
      'created_at', f.created_at,
      'status', f.status,
      'paymentStatus',
        case
          when o.status = 'cancelled' then 'cancelled'
          when o.status = 'pending_payment' then 'pending_payment'
          else 'paid'
        end
    ) as row
    from public.merchant_order_fulfillments f
    join public.orders o on o.id = f.order_id
    where f.owner_id = p_actor
      and f.store_id = target_store_id
    order by f.created_at desc, f.order_id desc
    offset p_page * 20
    limit 21
  ) page;

  return result;
end
$function$;
