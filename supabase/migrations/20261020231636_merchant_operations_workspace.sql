-- Operational records stay behind verified server routes. No browser role can
-- call these RPCs or write the tables directly.
create table public.merchant_members (
  id uuid primary key default gen_random_uuid(), store_id text not null references public.merchant_stores(id),
  user_id uuid unique references auth.users(id), email text not null unique check(email=lower(trim(email)) and length(email) between 3 and 254), name text not null check(length(name) between 2 and 100),
  role text not null check(role in ('sales','warehouse','driver')),
  driver_id uuid references public.merchant_delivery_staff(id), active boolean not null default true,
  version integer not null default 0, created_at timestamptz not null default now(),
  check(role<>'driver' or driver_id is not null)
);
create index merchant_members_store_idx on public.merchant_members(store_id);
create index merchant_members_driver_idx on public.merchant_members(driver_id);
-- Only the server supplies email freshly verified by Auth.getUser, and only
-- after email confirmation. Pending entries do not grant account-wide roles.
create function public.claim_merchant_membership(p_actor uuid,p_verified_email text) returns void
language plpgsql security invoker set search_path='' as $$
begin
  if p_verified_email is null or not exists(select 1 from public.profiles where id=p_actor and role='customer') then return; end if;
  update public.merchant_members set user_id=p_actor where email=lower(trim(p_verified_email)) and user_id is null and active
    and not exists(select 1 from public.merchant_members where user_id=p_actor);
end $$;
create table public.merchant_branches (
  id uuid primary key default gen_random_uuid(), store_id text not null references public.merchant_stores(id),
  name text not null check(length(name) between 2 and 100), kind text not null check(kind in ('showroom','warehouse')),
  address text not null default '' check(length(address)<=500), active boolean not null default true,
  version integer not null default 0, created_at timestamptz not null default now()
);
create index merchant_branches_store_idx on public.merchant_branches(store_id);
create table public.merchant_branch_stock (
  branch_id uuid not null references public.merchant_branches(id),
  product_id text not null references public.furniture_models(product_id),
  quantity integer not null check(quantity>=0), updated_at timestamptz not null default now(),
  primary key(branch_id,product_id)
);
create index merchant_branch_stock_product_idx on public.merchant_branch_stock(product_id);
create table public.merchant_operation_events (
  id uuid primary key default gen_random_uuid(), store_id text not null references public.merchant_stores(id),
  actor_id uuid references auth.users(id), action text not null, details jsonb not null,
  created_at timestamptz not null default now()
);
create index merchant_operation_events_store_idx on public.merchant_operation_events(store_id,created_at desc);
create table public.product_photo_reviews (
  id uuid primary key default gen_random_uuid(), store_id text not null references public.merchant_stores(id),
  order_id uuid not null references public.orders(id), product_id text not null,
  user_id uuid not null references auth.users(id), rating integer not null check(rating between 1 and 5),
  body text not null check(length(body) between 5 and 2000), photos jsonb not null default '[]' check(jsonb_typeof(photos)='array' and jsonb_array_length(photos)<=4),
  status text not null default 'pending' check(status in ('pending','approved','rejected')),
  reply text not null default '' check(length(reply)<=2000), version integer not null default 0,
  created_at timestamptz not null default now(), unique(order_id,product_id,user_id)
);
create index product_photo_reviews_store_idx on public.product_photo_reviews(store_id,status,created_at desc);
create index product_photo_reviews_product_idx on public.product_photo_reviews(product_id,status,created_at desc);
create index product_photo_reviews_user_idx on public.product_photo_reviews(user_id);
create table public.merchant_order_cases (
  id uuid primary key default gen_random_uuid(), store_id text not null references public.merchant_stores(id),
  order_id uuid not null references public.orders(id), user_id uuid not null references auth.users(id),
  kind text not null check(kind in ('return','complaint')),
  reason text not null check(length(reason) between 5 and 2000), photos jsonb not null default '[]' check(jsonb_typeof(photos)='array' and jsonb_array_length(photos)<=4),
  status text not null default 'requested' check(status in ('requested','reviewing','returned','resolved','rejected')),
  reply text not null default '' check(length(reply)<=2000), version integer not null default 0,
  created_at timestamptz not null default now(), unique(order_id,store_id)
);
create index merchant_order_cases_store_idx on public.merchant_order_cases(store_id,created_at desc);
create index merchant_order_cases_user_idx on public.merchant_order_cases(user_id);
create table public.customer_feedback_media (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
  order_id uuid not null references public.orders(id), public_id text not null unique,
  url text, created_at timestamptz not null default now()
);
create index customer_feedback_media_user_idx on public.customer_feedback_media(user_id,created_at desc);
create index customer_feedback_media_order_idx on public.customer_feedback_media(order_id);
create table public.merchant_assistant_settings (
  store_id text primary key references public.merchant_stores(id), enabled boolean not null default false,
  greeting text not null default 'Сайн байна уу? Бид танд хэрхэн туслах вэ?' check(length(greeting)<=500),
  fallback text not null default 'Энэ асуултаар дэлгүүртэй шууд холбогдоно уу.' check(length(fallback) between 5 and 500),
  faqs jsonb not null default '[]' check(jsonb_typeof(faqs)='array' and jsonb_array_length(faqs)<=30), version integer not null default 0
);
do $$ declare t text; begin
  foreach t in array array['merchant_members','merchant_branches','merchant_branch_stock','merchant_operation_events','product_photo_reviews','merchant_order_cases','merchant_assistant_settings','customer_feedback_media'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant select,insert,update on public.%I to service_role',t);
  end loop;
end $$;

-- One membership per login. Revocations and owner-role changes take effect on
-- the next request; no editable JWT metadata is trusted.
create function public.merchant_workspace_access(p_actor uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare s public.merchant_stores; m public.merchant_members;
begin
  select s1.* into s from public.merchant_stores s1 join public.profiles p on p.id=s1.owner_id and p.role='merchant'
    where s1.owner_id=p_actor and s1.active;
  if found then
    perform public.merchant_delivery_store(p_actor);
    return jsonb_build_object('role','owner','storeId',s.id,'storeName',s.name,'ownerId',s.owner_id);
  end if;
  select * into m from public.merchant_members where user_id=p_actor and active for share;
  if not found then raise exception using errcode='42501',message='Store access required'; end if;
  select s1.* into s from public.merchant_stores s1 join public.profiles p on p.id=s1.owner_id and p.role='merchant'
    where s1.id=m.store_id and s1.active;
  if not found then raise exception using errcode='42501',message='Active merchant required'; end if;
  perform public.merchant_delivery_store(s.owner_id);
  if m.role='driver' and not exists(select 1 from public.merchant_delivery_staff where id=m.driver_id and store_id=s.id and active) then
    raise exception using errcode='42501',message='Active driver required'; end if;
  return jsonb_build_object('role',m.role,'storeId',s.id,'storeName',s.name,'ownerId',s.owner_id,'driverId',m.driver_id);
end $$;

-- Branch quantities allocate the existing sellable total. Checkout still owns
-- the total stock. Shrinkage consumes unassigned stock first, then allocations;
-- cancellation restores unassigned stock, avoiding fictitious branch returns.
create function public.reconcile_branch_stock() returns trigger
language plpgsql security invoker set search_path='' as $$
declare excess bigint; r record; taken integer;
begin
  select coalesce(sum(quantity),0)-greatest(coalesce(new.in_stock,0),0) into excess from public.merchant_branch_stock where product_id=new.product_id;
  if excess>0 then
    for r in select bs.*,b.store_id from public.merchant_branch_stock bs join public.merchant_branches b on b.id=bs.branch_id
      where bs.product_id=new.product_id and bs.quantity>0 order by bs.updated_at,bs.branch_id for update of bs loop
      taken:=least(excess,r.quantity);
      update public.merchant_branch_stock set quantity=quantity-taken,updated_at=now() where branch_id=r.branch_id and product_id=new.product_id;
      insert into public.merchant_operation_events(store_id,action,details) values(r.store_id,'stock_reconciled',jsonb_build_object('productId',new.product_id,'branchId',r.branch_id,'quantity',-taken));
      excess:=excess-taken; exit when excess<=0;
    end loop;
  end if;
  return new;
end $$;
create trigger reconcile_branch_stock after update of in_stock on public.furniture_models for each row execute function public.reconcile_branch_stock();

create function public.merchant_operations(p_actor uuid,p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare a jsonb; sid text; role_name text; target uuid; uid uuid; did uuid; v integer; b public.merchant_branches;
  total integer; assigned bigint; qty integer; result jsonb; page_no integer; day date; term text;
begin
  a:=public.merchant_workspace_access(p_actor); sid:=a->>'storeId'; role_name:=a->>'role';
  if role_name<>'owner' and not (
    (role_name='warehouse' and p_action in ('branches','allocate')) or
    (role_name='sales' and p_action in ('reviews','review','cases','case','orders'))
  ) then raise exception using errcode='42501',message='Permission denied'; end if;
  page_no:=coalesce((p_data->>'page')::integer,0);
  if page_no<0 or page_no>100000 then raise exception using errcode='22023',message='Invalid page'; end if;
  if p_action='branches' then
    term:=left(coalesce(p_data->>'search',''),100);
    return jsonb_build_object('branches',coalesce((select jsonb_agg(to_jsonb(x) order by x.name) from public.merchant_branches x where store_id=sid),'[]'),
      'products',coalesce((select jsonb_agg(to_jsonb(x)) from (select product_id as id,name,in_stock as total,
        coalesce((select sum(quantity) from public.merchant_branch_stock where product_id=f.product_id),0) as assigned,
        coalesce((select jsonb_object_agg(branch_id,quantity) from public.merchant_branch_stock where product_id=f.product_id),'{}') as stock
        from public.furniture_models f where store_ids=jsonb_build_array(sid) and archived_at is null and name ilike '%'||term||'%'
        order by name,product_id limit 51 offset page_no*50) x),'[]'));
  elsif p_action='branch' then
    if length(trim(p_data->>'name')) not between 2 and 100 or p_data->>'kind' not in ('showroom','warehouse') or length(coalesce(p_data->>'address',''))>500 then
      raise exception using errcode='22023',message='Invalid branch'; end if;
    target:=nullif(p_data->>'id','')::uuid;
    if target is null then
      insert into public.merchant_branches(store_id,name,kind,address) values(sid,trim(p_data->>'name'),p_data->>'kind',coalesce(p_data->>'address',''));
    else
      -- Lock products first, matching checkout and allocation lock order.
      perform 1 from public.furniture_models f where exists(select 1 from public.merchant_branch_stock bs where bs.branch_id=target and bs.product_id=f.product_id) order by f.id for update;
      select * into b from public.merchant_branches where id=target and store_id=sid for update;
      if not found then raise exception using errcode='P0002',message='Branch not found'; end if;
      if b.version is distinct from (p_data->>'version')::integer then raise exception using errcode='P0003',message='Stale branch'; end if;
      if not coalesce((p_data->>'active')::boolean,true) and exists(select 1 from public.merchant_branch_stock where branch_id=target and quantity>0) then
        raise exception using errcode='22023',message='Reallocate branch stock first'; end if;
      update public.merchant_branches set name=trim(p_data->>'name'),kind=p_data->>'kind',address=coalesce(p_data->>'address',''),active=coalesce((p_data->>'active')::boolean,true),version=version+1 where id=target;
    end if;
  elsif p_action='allocate' then
    target:=(p_data->>'branchId')::uuid; qty:=(p_data->>'quantity')::integer;
    if qty is null or qty<0 or qty>1000000 then raise exception using errcode='22023',message='Invalid quantity'; end if;
    select in_stock into total from public.furniture_models where product_id=p_data->>'productId' and store_ids=jsonb_build_array(sid) and archived_at is null for update;
    if not found then raise exception using errcode='P0002',message='Product not found'; end if;
    perform 1 from public.merchant_branches where id=target and store_id=sid and active for share;
    if not found then raise exception using errcode='P0002',message='Branch not found'; end if;
    if total is distinct from (p_data->>'expectedTotal')::integer or coalesce((select quantity from public.merchant_branch_stock where branch_id=target and product_id=p_data->>'productId'),0) is distinct from (p_data->>'expectedQuantity')::integer then
      raise exception using errcode='P0003',message='Stale stock'; end if;
    select coalesce(sum(quantity),0) into assigned from public.merchant_branch_stock where product_id=p_data->>'productId' and branch_id<>target;
    if assigned+qty>coalesce(total,0) then raise exception using errcode='P0003',message='Allocation exceeds total stock'; end if;
    insert into public.merchant_branch_stock(branch_id,product_id,quantity) values(target,p_data->>'productId',qty)
      on conflict(branch_id,product_id) do update set quantity=excluded.quantity,updated_at=now();
  elsif p_action='staff' then
    return jsonb_build_object('members',coalesce((select jsonb_agg(to_jsonb(m) order by m.name) from public.merchant_members m where store_id=sid),'[]'),
      'drivers',public.read_merchant_delivery_staff((a->>'ownerId')::uuid));
  elsif p_action='member' then
    if p_data->>'role' not in ('sales','warehouse','driver') or length(trim(p_data->>'name')) not between 2 and 100 then raise exception using errcode='22023',message='Invalid member'; end if;
    target:=nullif(p_data->>'id','')::uuid; did:=nullif(p_data->>'driverId','')::uuid;
    if p_data->>'role'='driver' and not exists(select 1 from public.merchant_delivery_staff where id=did and store_id=sid and (active or (p_data->>'active')::boolean=false)) then raise exception using errcode='22023',message='Select an active delivery driver'; end if;
    if target is null then
      insert into public.merchant_members(store_id,email,name,role,driver_id,active) values(sid,lower(trim(p_data->>'email')),trim(p_data->>'name'),p_data->>'role',case when p_data->>'role'='driver' then did end,coalesce((p_data->>'active')::boolean,true));
    else
      update public.merchant_members set name=trim(p_data->>'name'),role=p_data->>'role',driver_id=case when p_data->>'role'='driver' then did end,
        active=coalesce((p_data->>'active')::boolean,true),version=version+1 where id=target and store_id=sid and version=(p_data->>'version')::integer;
      if not found then raise exception using errcode='P0003',message='Stale member'; end if;
    end if;
  elsif p_action='reviews' then
    return jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(x)) from (select r.*,p.full_name as customer from public.product_photo_reviews r left join public.profiles p on p.id=r.user_id
      where store_id=sid and (coalesce(p_data->>'status','')='' or r.status=p_data->>'status') order by r.created_at desc,r.id limit 21 offset page_no*20) x),'[]'));
  elsif p_action='review' then
    if p_data->>'status' not in ('pending','approved','rejected') or length(coalesce(p_data->>'reply',''))>2000 then raise exception using errcode='22023',message='Invalid review'; end if;
    perform 1 from public.furniture_models where product_id=(select product_id from public.product_photo_reviews where id=(p_data->>'id')::uuid and store_id=sid) for update;
    update public.product_photo_reviews set status=p_data->>'status',reply=coalesce(p_data->>'reply',''),version=version+1
      where id=(p_data->>'id')::uuid and store_id=sid and version=(p_data->>'version')::integer returning product_id into term;
    if not found then raise exception using errcode='P0003',message='Stale review'; end if;
    update public.furniture_models set review_count=(select count(*) from public.product_photo_reviews where product_id=term and status='approved'),
      rating=(select coalesce(round(avg(rating),1),0) from public.product_photo_reviews where product_id=term and status='approved'),updated_at=now() where product_id=term;
  elsif p_action='cases' then
    return jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from public.merchant_order_cases where store_id=sid order by created_at desc,id limit 21 offset page_no*20) x),'[]'));
  elsif p_action='case' then
    if p_data->>'status' not in ('reviewing','returned','resolved','rejected') or length(trim(p_data->>'reply')) not between 5 and 2000 then raise exception using errcode='22023',message='Reply required'; end if;
    update public.merchant_order_cases set status=p_data->>'status',reply=trim(p_data->>'reply'),version=version+1
      where id=(p_data->>'id')::uuid and store_id=sid and version=(p_data->>'version')::integer
      and status in ('requested','reviewing') and (kind='return' or p_data->>'status'<>'returned');
    if not found then raise exception using errcode='P0003',message='Stale case'; end if;
  elsif p_action='assistant' then
    return coalesce((select to_jsonb(s) from public.merchant_assistant_settings s where store_id=sid),jsonb_build_object('enabled',false,'greeting','Сайн байна уу?','fallback','Дэлгүүртэй шууд холбогдоно уу.','faqs','[]'::jsonb,'version',0));
  elsif p_action='save_assistant' then
    if jsonb_typeof(p_data->'faqs') is distinct from 'array' or jsonb_array_length(p_data->'faqs')>30 or exists(select 1 from jsonb_array_elements(p_data->'faqs') f where
      length(trim(f->>'question')) not between 3 and 300 or length(trim(f->>'answer')) not between 3 and 2000 or f->>'question' is null or f->>'answer' is null) then raise exception using errcode='22023',message='Invalid FAQ'; end if;
    insert into public.merchant_assistant_settings(store_id,enabled,greeting,fallback,faqs,version)
      values(sid,(p_data->>'enabled')::boolean,p_data->>'greeting',p_data->>'fallback',p_data->'faqs',1)
      on conflict(store_id) do update set enabled=excluded.enabled,greeting=excluded.greeting,fallback=excluded.fallback,faqs=excluded.faqs,version=merchant_assistant_settings.version+1
      where merchant_assistant_settings.version=(p_data->>'version')::integer;
    if not found then raise exception using errcode='P0003',message='Stale assistant settings'; end if;
  elsif p_action='risk' then
    day:=coalesce((p_data->>'date')::date,(now() at time zone 'Asia/Ulaanbaatar')::date);
    select jsonb_build_object('total',count(*),'cancelled',count(*) filter(where o.status='cancelled'),
      'returned',count(*) filter(where exists(select 1 from public.merchant_order_cases c where c.order_id=f.order_id and c.store_id=sid and c.status='returned')),
      'complaints',count(*) filter(where exists(select 1 from public.merchant_order_cases c where c.order_id=f.order_id and c.store_id=sid and c.status in ('requested','reviewing')))) into result
      from public.merchant_order_fulfillments f join public.orders o on o.id=f.order_id where f.store_id=sid and (f.created_at at time zone 'Asia/Ulaanbaatar')::date=day;
    return result;
  elsif p_action='orders' then
    return public.read_merchant_orders((a->>'ownerId')::uuid,page_no);
  else raise exception using errcode='22023',message='Unknown operation';
  end if;
  insert into public.merchant_operation_events(store_id,actor_id,action,details) values(sid,p_actor,p_action,p_data-'faqs');
  return jsonb_build_object('ok',true);
end $$;

-- Driver records are already assigned by the owner's dispatch workflow.
create function public.staff_delivery(p_actor uuid,p_action text,p_data jsonb) returns jsonb
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
      'id',v.order_id,'items',v.items,'subtotal',v.subtotal,'delivery',jsonb_build_object('name',v.delivery->>'name','phone',v.delivery->>'phone','address',v.delivery->>'address'),'stage',v.delivery_stage,'version',v.delivery_version,'driver',v.delivery_driver_snapshot,
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

create function public.customer_store_feedback(p_actor uuid,p_action text,p_data jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare f public.merchant_order_fulfillments; result jsonb; oid uuid; sid text;
begin
  oid:=(p_data->>'orderId')::uuid;
  if not exists(select 1 from public.orders where id=oid and user_id=p_actor) then raise exception using errcode='42501',message='Own order required'; end if;
  if p_action='read' then
    return jsonb_build_object('cases',coalesce((select jsonb_agg(to_jsonb(c)) from public.merchant_order_cases c where order_id=oid and user_id=p_actor),'[]'),
      'reviews',coalesce((select jsonb_agg(to_jsonb(r)) from public.product_photo_reviews r where order_id=oid and user_id=p_actor),'[]'),
      'stores',coalesce((select jsonb_agg(jsonb_build_object('id',ff.store_id,'name',s.name,'stage',ff.delivery_stage,'items',ff.items)) from public.merchant_order_fulfillments ff join public.merchant_stores s on s.id=ff.store_id where order_id=oid),'[]'));
  end if;
  sid:=p_data->>'storeId';
  select * into f from public.merchant_order_fulfillments where order_id=oid and store_id=sid;
  if not found or not exists(select 1 from public.orders where id=oid and status not in ('pending_payment','cancelled')) then raise exception using errcode='42501',message='Paid store order required'; end if;
  if jsonb_typeof(p_data->'photos') is distinct from 'array' or jsonb_array_length(p_data->'photos')>4 or exists(select 1 from jsonb_array_elements_text(p_data->'photos') photo where not exists(
    select 1 from public.customer_feedback_media m where m.user_id=p_actor and m.order_id=oid and m.url=photo)) then raise exception using errcode='22023',message='Invalid photos'; end if;
  if p_action='review' then
    if f.delivery_stage not in ('delivered','completed') or not exists(select 1 from jsonb_array_elements(f.items) i where i->>'productId'=p_data->>'productId') then raise exception using errcode='42501',message='Delivered product required'; end if;
    insert into public.product_photo_reviews(store_id,order_id,product_id,user_id,rating,body,photos) values(sid,oid,p_data->>'productId',p_actor,(p_data->>'rating')::integer,trim(p_data->>'body'),p_data->'photos');
  elsif p_action='case' then
    if f.delivery_stage not in ('shipped','delivered','completed') then raise exception using errcode='22023',message='Use cancellation before dispatch'; end if;
    insert into public.merchant_order_cases(store_id,order_id,user_id,kind,reason,photos) values(sid,oid,p_actor,p_data->>'kind',trim(p_data->>'reason'),p_data->'photos');
  else raise exception using errcode='22023',message='Unknown operation'; end if;
  return jsonb_build_object('ok',true);
end $$;

create function public.public_store_feedback(p_store text default null,p_product text default null) returns jsonb
language sql security invoker set search_path='' as $$
  select jsonb_build_object('assistant',(select jsonb_build_object('enabled',true,'greeting',a.greeting,'fallback',a.fallback,'faqs',a.faqs)
    from public.merchant_assistant_settings a join public.merchant_stores s on s.id=a.store_id where s.active and s.id=p_store and a.enabled),
    'reviews',coalesce((select jsonb_agg(to_jsonb(x)) from (select r.rating,r.body,r.photos,r.reply,r.created_at
      from public.product_photo_reviews r join public.merchant_stores s on s.id=r.store_id where s.active and r.product_id=p_product and r.status='approved'
      order by r.created_at desc,r.id desc limit 50) x),'[]'::jsonb),
    'summary',(select jsonb_build_object('count',count(*),'rating',coalesce(round(avg(r.rating),1),0)) from public.product_photo_reviews r join public.merchant_stores s on s.id=r.store_id where s.active and r.product_id=p_product and r.status='approved'))
$$;
create function public.feedback_media(p_actor uuid,p_order uuid,p_id uuid,p_url text default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare public_key text;
begin
  if not exists(select 1 from public.orders where id=p_order and user_id=p_actor and status not in ('pending_payment','cancelled')) then raise exception using errcode='42501',message='Own paid order required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_actor::text,723));
  if p_url is null then
    if (select count(*) from public.customer_feedback_media where user_id=p_actor and created_at>now()-interval '1 day')>=20 then raise exception using errcode='22023',message='Daily image limit'; end if;
    public_key:='casa-nova/feedback/'||p_actor::text||'/'||p_id::text;
    insert into public.customer_feedback_media(id,user_id,order_id,public_id) values(p_id,p_actor,p_order,public_key);
    return jsonb_build_object('publicId',public_key);
  end if;
  if p_url!~'^https://res[.]cloudinary[.]com/' then raise exception using errcode='22023',message='Invalid image'; end if;
  update public.customer_feedback_media set url=p_url where id=p_id and user_id=p_actor and order_id=p_order and url is null;
  if not found then raise exception using errcode='P0003',message='Image intent changed'; end if;
  return jsonb_build_object('ok',true);
end $$;

revoke all on function public.merchant_workspace_access(uuid),public.reconcile_branch_stock(),public.merchant_operations(uuid,text,jsonb),public.staff_delivery(uuid,text,jsonb),public.customer_store_feedback(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.merchant_workspace_access(uuid),public.reconcile_branch_stock(),public.merchant_operations(uuid,text,jsonb),public.staff_delivery(uuid,text,jsonb),public.customer_store_feedback(uuid,text,jsonb) to service_role;
revoke all on function public.public_store_feedback(text,text),public.feedback_media(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.public_store_feedback(text,text),public.feedback_media(uuid,uuid,uuid,text) to service_role;
revoke all on function public.claim_merchant_membership(uuid,text) from public,anon,authenticated;
grant execute on function public.claim_merchant_membership(uuid,text) to service_role;
notify pgrst,'reload schema';
