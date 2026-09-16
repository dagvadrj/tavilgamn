-- Merchant permissions are granted by admins. Public clients never write these tables.
begin;

alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('customer','merchant','admin'));
alter table public.profiles enable row level security;
revoke all on public.profiles from public, anon, authenticated;
grant select on public.profiles to authenticated;

create table public.merchant_stores (
  id text primary key default ('merchant-' || gen_random_uuid()::text),
  owner_id uuid not null unique references auth.users(id) on delete restrict,
  store_type text not null check (store_type in ('factory','handmade','retail')),
  name text not null check (char_length(trim(name)) between 1 and 200),
  city text not null check (char_length(trim(city)) between 1 and 100),
  district text not null default '' check (char_length(district) <= 100),
  address text not null check (char_length(trim(address)) between 1 and 1000),
  phone text not null check (char_length(trim(phone)) between 1 and 50),
  description text not null default '' check (char_length(description) <= 5000),
  image text not null default '' check (char_length(image) <= 2000),
  categories jsonb not null default '[]' check (jsonb_typeof(categories)='array' and jsonb_array_length(categories)<=7),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.merchant_stores enable row level security;
revoke all on public.merchant_stores from public, anon, authenticated;
grant select(id,store_type,name,city,district,address,phone,description,image,categories,active) on public.merchant_stores to anon, authenticated;
grant all on public.merchant_stores to service_role;
create policy merchant_stores_public on public.merchant_stores for select to anon,authenticated using(active);

-- All functions use invoker rights and are callable only with the server secret.
-- The server verifies getUser(token); RPCs recheck and lock the current profile
-- so an in-flight request cannot write after a simultaneous role revocation.
create function public.read_merchant_store(p_actor uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
  perform 1 from public.profiles where id=p_actor and role='merchant' for share;
  if not found then raise exception using errcode='42501',message='Merchant required'; end if;
  select to_jsonb(s)-'owner_id' into result from public.merchant_stores s where owner_id=p_actor and active for share;
  return result;
end $$;

create function public.save_merchant_store(p_actor uuid,p_data jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result public.merchant_stores;
begin
  perform 1 from public.profiles where id=p_actor and role='merchant' for share;
  if not found then raise exception using errcode='42501',message='Merchant required'; end if;
  if exists(select 1 from public.merchant_stores where owner_id=p_actor and not active) then
    raise exception using errcode='42501',message='Store disabled';
  end if;
  if jsonb_typeof(p_data->'categories') is distinct from 'array'
    or exists(select 1 from jsonb_array_elements_text(p_data->'categories') c where c not in ('sofa','wardrobe','dining-table','office','bed','tv-stand','bookshelf')) then
    raise exception using errcode='22023',message='Invalid categories';
  end if;
  insert into public.merchant_stores(owner_id,store_type,name,city,district,address,phone,description,image,categories)
    values(p_actor,p_data->>'storeType',p_data->>'name',p_data->>'city',p_data->>'district',p_data->>'address',p_data->>'phone',p_data->>'description',p_data->>'image',p_data->'categories')
  on conflict(owner_id) do update set store_type=excluded.store_type,name=excluded.name,city=excluded.city,district=excluded.district,
    address=excluded.address,phone=excluded.phone,description=excluded.description,image=excluded.image,categories=excluded.categories,updated_at=now()
  returning * into result;
  return to_jsonb(result)-'owner_id';
end $$;

create function public.read_merchant_products(p_actor uuid,p_after uuid default null) returns setof public.furniture_models
language plpgsql security invoker set search_path='' as $$
declare store_id text;
begin
  perform 1 from public.profiles where id=p_actor and role='merchant' for share;
  if not found then raise exception using errcode='42501',message='Merchant required'; end if;
  select id into store_id from public.merchant_stores where owner_id=p_actor and active for share;
  if not found then return; end if;
  return query select m.* from public.furniture_models m
    where m.store_ids=jsonb_build_array(store_id) and (p_after is null or m.id>p_after) order by m.id limit 500;
end $$;

create function public.save_merchant_product(p_actor uuid,p_data jsonb,p_create boolean,p_expected_stock integer default null) returns void
language plpgsql security invoker set search_path='' as $$
declare store_id text; current_product public.furniture_models; safe_data jsonb;
begin
  perform 1 from public.profiles where id=p_actor and role='merchant' for share;
  if not found then raise exception using errcode='42501',message='Merchant required'; end if;
  select id into store_id from public.merchant_stores where owner_id=p_actor and active for share;
  if not found then raise exception using errcode='42501',message='Active store required'; end if;
  if not p_create then
    select * into current_product from public.furniture_models
      where product_id=p_data->>'id' and store_ids=jsonb_build_array(store_id) for update;
    if not found then raise exception using errcode='P0002',message='Product not found'; end if;
  end if;
  safe_data := p_data || jsonb_build_object('storeIds',jsonb_build_array(store_id),
    'rating',coalesce(current_product.rating,0),'reviewCount',coalesce(current_product.review_count,0),
    'badges',coalesce(current_product.badges,'[]'::jsonb),'isNew',coalesce(current_product.is_new,false),
    'isBestSeller',coalesce(current_product.is_best_seller,false));
  perform public.save_furniture_product(safe_data,p_create,p_expected_stock);
end $$;

create function public.set_merchant_role(p_actor uuid,p_target uuid,p_role text) returns void
language plpgsql security invoker set search_path='' as $$
declare target_role text;
begin
  if p_actor=p_target or p_role not in ('customer','merchant') or p_role is null then
    raise exception using errcode='42501',message='Invalid role assignment';
  end if;
  perform 1 from public.profiles where id=p_actor and role='admin' for share;
  if not found then raise exception using errcode='42501',message='Admin required'; end if;
  select role into target_role from public.profiles where id=p_target for update;
  if not found then raise exception using errcode='P0002',message='Profile not found'; end if;
  if target_role='admin' then raise exception using errcode='42501',message='Admin protected'; end if;
  update public.profiles set role=p_role where id=p_target;
  update public.merchant_stores set active=(p_role='merchant'),updated_at=now() where owner_id=p_target;
end $$;

-- Immutable per-store snapshots prevent catalog reassignment from exposing old
-- orders to a new merchant. Historical orders are deliberately not backfilled.
create table public.merchant_order_fulfillments (
  order_id uuid not null references public.orders(id) on delete restrict,
  store_id text not null references public.merchant_stores(id) on delete restrict,
  owner_id uuid not null references auth.users(id) on delete restrict,
  items jsonb not null check(jsonb_typeof(items)='array' and jsonb_array_length(items)>0),
  subtotal bigint not null check(subtotal>=0),
  status text not null default 'pending' check(status in ('pending','processing','shipped','delivered')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(order_id,store_id)
);
create index merchant_orders_owner_created_idx on public.merchant_order_fulfillments(owner_id,created_at desc,order_id desc);
alter table public.merchant_order_fulfillments enable row level security;
revoke all on public.merchant_order_fulfillments from public,anon,authenticated;
grant all on public.merchant_order_fulfillments to service_role;

create function public.snapshot_merchant_order() returns trigger
language plpgsql security invoker set search_path='' as $$
declare line jsonb; stores jsonb; merchant public.merchant_stores;
begin
  for line in select value from jsonb_array_elements(new.items) loop
    -- reserve_order_stock already holds these product locks until commit.
    select store_ids into stores from public.furniture_models where product_id=line->>'productId';
    if not exists(select 1 from public.merchant_stores s where stores ? s.id) then continue; end if;
    if jsonb_typeof(stores) is distinct from 'array' or jsonb_array_length(stores)<>1 then
      raise exception using errcode='P0008',message='Ambiguous merchant ownership';
    end if;
    select s.* into merchant from public.merchant_stores s join public.profiles p on p.id=s.owner_id
      where s.id=stores->>0 and s.active and p.role='merchant';
    if not found then raise exception using errcode='P0008',message='Merchant unavailable'; end if;
  end loop;
  insert into public.merchant_order_fulfillments(order_id,store_id,owner_id,items,subtotal,created_at)
    select new.id,s.id,s.owner_id,jsonb_agg(x.line order by x.ordinal),sum((x.line->>'lineTotal')::bigint),new.created_at
    from jsonb_array_elements(new.items) with ordinality as x(line,ordinal)
    join public.furniture_models m on m.product_id=x.line->>'productId'
    join public.merchant_stores s on m.store_ids=jsonb_build_array(s.id)
    group by s.id,s.owner_id;
  return new;
end $$;
create trigger snapshot_merchant_order after insert on public.orders for each row execute function public.snapshot_merchant_order();

create function public.protect_merchant_order_snapshot() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if row(new.order_id,new.store_id,new.owner_id,new.items,new.subtotal,new.created_at)
    is distinct from row(old.order_id,old.store_id,old.owner_id,old.items,old.subtotal,old.created_at) then
    raise exception using errcode='42501',message='Order ownership and items are immutable';
  end if;
  return new;
end $$;
create trigger protect_merchant_order_snapshot before update on public.merchant_order_fulfillments
  for each row execute function public.protect_merchant_order_snapshot();

create function public.read_merchant_orders(p_actor uuid,p_page integer default 0) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare target_store_id text; result jsonb;
begin
  if p_page is null or p_page<0 or p_page>100000 then raise exception using errcode='22023',message='Invalid page'; end if;
  perform 1 from public.profiles where id=p_actor and role='merchant' for share;
  if not found then raise exception using errcode='42501',message='Merchant required'; end if;
  select id into target_store_id from public.merchant_stores where owner_id=p_actor and active for share;
  if not found then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(page.row),'[]'::jsonb) into result from (
    select jsonb_build_object('id',f.order_id,'items',f.items,'subtotal',f.subtotal,'currency',o.currency,
      'delivery',jsonb_build_object('name',o.delivery->>'name','phone',o.delivery->>'phone','address',o.delivery->>'address'),
      'created_at',f.created_at,'status',f.status,
      'paymentStatus',case when o.status='cancelled' then 'cancelled' when o.status='pending_payment' then 'pending_payment' else 'paid' end) as row
    from public.merchant_order_fulfillments f join public.orders o on o.id=f.order_id
    where f.owner_id=p_actor and f.store_id=target_store_id order by f.created_at desc,f.order_id desc offset p_page*20 limit 21
  ) page;
  return result;
end $$;

create function public.update_merchant_order(p_actor uuid,p_order uuid,p_status text,p_expected_status text) returns void
language plpgsql security invoker set search_path='' as $$
declare target_store_id text; order_status text; current_status text;
begin
  perform 1 from public.profiles where id=p_actor and role='merchant' for share;
  if not found then raise exception using errcode='42501',message='Merchant required'; end if;
  select id into target_store_id from public.merchant_stores where owner_id=p_actor and active for share;
  if not found then raise exception using errcode='42501',message='Active store required'; end if;
  -- Ownership is checked before accessing another store's order or payment state.
  if not exists(select 1 from public.merchant_order_fulfillments f where f.order_id=p_order and f.store_id=target_store_id and f.owner_id=p_actor) then
    raise exception using errcode='P0002',message='Order not found';
  end if;
  select status into order_status from public.orders where id=p_order for update;
  if order_status is null or order_status in ('pending_payment','cancelled') then
    raise exception using errcode='P0009',message='Order not ready for fulfillment';
  end if;
  select f.status into current_status from public.merchant_order_fulfillments f
    where f.order_id=p_order and f.store_id=target_store_id and f.owner_id=p_actor for update;
  if current_status is distinct from p_expected_status then raise exception using errcode='P0009',message='Fulfillment changed'; end if;
  if p_status is distinct from (case current_status when 'pending' then 'processing' when 'processing' then 'shipped' when 'shipped' then 'delivered' else null end)
    or p_status is null then raise exception using errcode='P0009',message='Invalid fulfillment transition'; end if;
  update public.merchant_order_fulfillments f set status=p_status,updated_at=now()
    where f.order_id=p_order and f.store_id=target_store_id and f.owner_id=p_actor;
end $$;

revoke all on function public.read_merchant_store(uuid),public.save_merchant_store(uuid,jsonb),
  public.read_merchant_products(uuid,uuid),public.save_merchant_product(uuid,jsonb,boolean,integer),
  public.set_merchant_role(uuid,uuid,text),public.snapshot_merchant_order(),public.protect_merchant_order_snapshot(),
  public.read_merchant_orders(uuid,integer),public.update_merchant_order(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.read_merchant_store(uuid),public.save_merchant_store(uuid,jsonb),
  public.read_merchant_products(uuid,uuid),public.save_merchant_product(uuid,jsonb,boolean,integer),
  public.set_merchant_role(uuid,uuid,text),public.snapshot_merchant_order(),public.protect_merchant_order_snapshot(),
  public.read_merchant_orders(uuid,integer),public.update_merchant_order(uuid,uuid,text,text) to service_role;

notify pgrst,'reload schema';
commit;
