-- Private merchant onboarding and financial operations. The HTTP layer supplies
-- the freshly authenticated actor; browsers have no direct table/RPC privileges.
create table public.merchant_growth_profiles (
  store_id text primary key references public.merchant_stores(id) on delete restrict,
  slug text unique check(slug is null or slug ~ '^[a-z0-9][a-z0-9-]{2,39}$'),
  legal_name text not null default '', registration_no text not null default '',
  certificate_path text, verification_status text not null default 'unsubmitted' check(verification_status in ('unsubmitted','pending','approved','rejected')),
  verification_version integer not null default 0,
  bank_name text not null default '', bank_account text not null default '', bank_holder text not null default '',
  bank_status text not null default 'unsubmitted' check(bank_status in ('unsubmitted','pending','approved','rejected')),
  bank_version integer not null default 0,
  review_note text not null default '', bank_note text not null default '',
  updated_at timestamptz not null default now()
);
create table public.merchant_wallet_transactions (
  id uuid primary key default gen_random_uuid(), store_id text not null references public.merchant_stores(id) on delete restrict,
  request_key uuid not null, kind text not null check(kind in ('withdrawal','credits')),
  amount bigint not null check(amount between 1 and 9007199254740991), credits bigint not null default 0 check(credits between 0 and 1000000),
  status text not null check(status in ('pending','paid','rejected','completed')),
  bank_snapshot jsonb not null default '{}'::jsonb,
  reference text, review_note text not null default '', reviewed_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(), reviewed_at timestamptz,
  unique(store_id,request_key),
  check((kind='credits' and status='completed' and credits>0) or (kind='withdrawal' and status in ('pending','paid','rejected') and credits=0)),
  check(status<>'paid' or (reference is not null and length(reference)>2 and reviewed_by is not null))
);
create unique index merchant_wallet_paid_reference on public.merchant_wallet_transactions(reference) where status='paid';
create index merchant_wallet_store_created on public.merchant_wallet_transactions(store_id,created_at desc,id);
create index merchant_wallet_reviewer on public.merchant_wallet_transactions(reviewed_by) where reviewed_by is not null;
create table public.merchant_credit_entries (
  id uuid primary key default gen_random_uuid(), store_id text not null references public.merchant_stores(id) on delete restrict,
  request_key text not null, delta bigint not null check(delta<>0 and abs(delta)<=1000000), reason text not null,
  actor_id uuid not null references public.profiles(id) on delete restrict, created_at timestamptz not null default now(),
  unique(store_id,request_key)
);
create index merchant_credit_store_created on public.merchant_credit_entries(store_id,created_at desc,id);
create index merchant_credit_actor on public.merchant_credit_entries(actor_id);
create table public.merchant_growth_settings (
  id integer primary key check(id=1), credit_price_mnt bigint not null default 0 check(credit_price_mnt between 0 and 1000000),
  background_credits integer not null default 0 check(background_credits between 0 and 100000),
  render_credits integer not null default 0 check(render_credits between 0 and 100000),
  model_credits integer not null default 0 check(model_credits between 0 and 100000),
  updated_by uuid references public.profiles(id) on delete restrict, updated_at timestamptz not null default now()
);
insert into public.merchant_growth_settings(id) values(1);
create index merchant_growth_settings_actor on public.merchant_growth_settings(updated_by);
create table public.merchant_model_submissions (
  id uuid primary key default gen_random_uuid(), store_id text not null references public.merchant_stores(id) on delete restrict,
  product_id text not null, object_path text not null unique, original_name text not null,
  status text not null default 'pending' check(status in ('pending','accepted','rejected')),
  review_note text not null default '', created_at timestamptz not null default now(), reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete restrict
);
create index merchant_model_submission_store on public.merchant_model_submissions(store_id,created_at desc);
create index merchant_model_submission_reviewer on public.merchant_model_submissions(reviewed_by) where reviewed_by is not null;
create table public.merchant_growth_audit (
  id uuid primary key default gen_random_uuid(), actor_id uuid not null references public.profiles(id) on delete restrict,
  store_id text references public.merchant_stores(id) on delete restrict, action text not null, details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index merchant_growth_audit_store on public.merchant_growth_audit(store_id,created_at desc);
create index merchant_growth_audit_actor on public.merchant_growth_audit(actor_id);

alter table public.merchant_growth_profiles enable row level security;
alter table public.merchant_wallet_transactions enable row level security;
alter table public.merchant_credit_entries enable row level security;
alter table public.merchant_growth_settings enable row level security;
alter table public.merchant_model_submissions enable row level security;
alter table public.merchant_growth_audit enable row level security;
revoke all on public.merchant_growth_profiles, public.merchant_wallet_transactions,public.merchant_credit_entries,public.merchant_growth_settings,public.merchant_model_submissions,public.merchant_growth_audit from public,anon,authenticated;
grant select,insert,update on public.merchant_growth_profiles,public.merchant_wallet_transactions,public.merchant_growth_settings,public.merchant_model_submissions to service_role;
grant select,insert on public.merchant_credit_entries,public.merchant_growth_audit to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('merchant-private','merchant-private',false,52428800,array['application/pdf','image/png','image/jpeg','model/gltf-binary','model/gltf+json','application/octet-stream'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create function public.merchant_growth_immutable() returns trigger
language plpgsql set search_path='' as $$begin raise exception using errcode='42501',message='Financial history is immutable'; end$$;
create trigger merchant_credit_immutable before update or delete on public.merchant_credit_entries for each row execute function public.merchant_growth_immutable();
create trigger merchant_growth_audit_immutable before update or delete on public.merchant_growth_audit for each row execute function public.merchant_growth_immutable();

create function public.merchant_wallet_protect() returns trigger
language plpgsql set search_path='' as $$
begin
  if tg_op='DELETE' then raise exception using errcode='42501',message='Wallet history is immutable'; end if;
  if row(new.id,new.store_id,new.request_key,new.kind,new.amount,new.credits,new.bank_snapshot,new.created_at)
    is distinct from row(old.id,old.store_id,old.request_key,old.kind,old.amount,old.credits,old.bank_snapshot,old.created_at)
    or old.status<>'pending' or new.status not in ('paid','rejected') then
    raise exception using errcode='42501',message='Wallet snapshot is immutable';
  end if;
  return new;
end$$;
create trigger merchant_wallet_protect before update or delete on public.merchant_wallet_transactions for each row execute function public.merchant_wallet_protect();

create function public.resolve_merchant_store_link(p_key text) returns jsonb
language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('storeId',s.id,'slug',g.slug,'verified',coalesce(g.verification_status='approved',false))
  from public.merchant_stores s left join public.merchant_growth_profiles g on g.store_id=s.id
  where s.active and (s.id=p_key or g.slug=p_key) order by (s.id=p_key) desc limit 1
$$;

create function public.merchant_wallet_balance(p_store text) returns jsonb
language sql stable security invoker set search_path='' as $$
  with earnings as (
    select coalesce(sum(f.merchant_net),0)::bigint earned
    from public.merchant_order_fulfillments f join public.orders o on o.id=f.order_id
    where f.store_id=p_store and f.delivery_stage='completed' and o.status<>'cancelled'
      and exists(select 1 from public.order_payments p where p.order_id=f.order_id and p.state='paid')
      and not exists(select 1 from public.order_cancellations c where c.order_id=f.order_id and c.status in ('requested','approved','refunded'))
  ), spending as (
    select coalesce(sum(amount) filter(where status<>'rejected'),0)::bigint spent,
      coalesce(sum(amount) filter(where status='pending'),0)::bigint reserved
    from public.merchant_wallet_transactions where store_id=p_store
  ) select jsonb_build_object('earned',earned::text,'available',(earned-spent)::text,'reserved',reserved::text,
    'credits',(select coalesce(sum(delta),0)::text from public.merchant_credit_entries where store_id=p_store)) from earnings,spending
$$;

create function public.read_merchant_growth(p_actor uuid) returns jsonb
language plpgsql volatile security invoker set search_path='' as $$
declare sid text; result jsonb;
begin
  sid:=public.merchant_delivery_store(p_actor);
  select jsonb_build_object('storeId',sid,
    'profile',coalesce((select to_jsonb(g) from public.merchant_growth_profiles g where store_id=sid),'{}'::jsonb),
    'wallet',public.merchant_wallet_balance(sid),
    'settings',(select to_jsonb(g)-'updated_by' from public.merchant_growth_settings g where id=1),
    'productCount',(select count(*) from public.furniture_models m where m.store_ids @> jsonb_build_array(sid) and m.archived_at is null),
    'modelCount',(select count(*) from public.furniture_models m where m.store_ids @> jsonb_build_array(sid) and m.archived_at is null and m.glb_path is not null and m.glb_path<>''),
    'transactions',coalesce((select jsonb_agg(to_jsonb(t)-'bank_snapshot' order by t.created_at desc) from (select * from public.merchant_wallet_transactions where store_id=sid order by created_at desc,id limit 30) t),'[]'::jsonb),
    'creditHistory',coalesce((select jsonb_agg(to_jsonb(t)-'actor_id' order by t.created_at desc) from (select * from public.merchant_credit_entries where store_id=sid order by created_at desc,id limit 30) t),'[]'::jsonb),
    'modelSubmissions',coalesce((select jsonb_agg(to_jsonb(t)-'object_path'-'reviewed_by' order by t.created_at desc) from (select * from public.merchant_model_submissions where store_id=sid order by created_at desc,id limit 20) t),'[]'::jsonb)
  ) into result;
  return result;
end$$;

create function public.save_merchant_growth(p_actor uuid,p_action text,p_data jsonb) returns jsonb
language plpgsql volatile security invoker set search_path='' as $$
declare sid text; profile public.merchant_growth_profiles; path text;
begin
  sid:=public.merchant_delivery_store(p_actor);
  perform pg_advisory_xact_lock(hashtextextended('merchant-growth:'||sid,0));
  insert into public.merchant_growth_profiles(store_id) values(sid) on conflict do nothing;
  select * into profile from public.merchant_growth_profiles where store_id=sid for update;
  if p_action='slug' then
    if p_data->>'slug' !~ '^[a-z0-9][a-z0-9-]{2,39}$' then raise exception using errcode='22023',message='Invalid store slug'; end if;
    -- Avoid aliases that shadow an existing store ID, including legacy store URLs.
    if exists(select 1 from public.merchant_stores where lower(id)=p_data->>'slug' and id<>sid) then raise unique_violation; end if;
    update public.merchant_growth_profiles set slug=p_data->>'slug',updated_at=now() where store_id=sid;
  elsif p_action='certificate' then
    path:=p_data->>'path';
    if length(p_data->>'legalName') not between 2 and 200 or length(p_data->>'registrationNo') not between 4 and 40
      or path not like p_actor::text||'/'||sid||'/certificate/%'
      or not exists(select 1 from storage.objects where bucket_id='merchant-private' and name=path)
      then raise exception using errcode='22023',message='Certificate is missing'; end if;
    update public.merchant_growth_profiles set legal_name=p_data->>'legalName',registration_no=p_data->>'registrationNo',certificate_path=path,
      verification_status='pending',verification_version=verification_version+1,review_note='',updated_at=now() where store_id=sid;
  elsif p_action='bank' then
    if length(p_data->>'bankName') not between 2 and 100 or length(p_data->>'holder') not between 2 and 200
      or p_data->>'account' !~ '^[A-Z0-9]{8,34}$' then raise exception using errcode='22023',message='Invalid bank account'; end if;
    update public.merchant_growth_profiles set bank_name=p_data->>'bankName',bank_account=p_data->>'account',bank_holder=p_data->>'holder',
      bank_status='pending',bank_version=bank_version+1,bank_note='',updated_at=now() where store_id=sid;
  elsif p_action='model' then
    path:=p_data->>'path';
    if path not like p_actor::text||'/'||sid||'/model/%' or not exists(select 1 from storage.objects where bucket_id='merchant-private' and name=path)
      or not exists(select 1 from public.furniture_models where product_id=p_data->>'productId' and store_ids=jsonb_build_array(sid) and archived_at is null)
      then raise exception using errcode='42501',message='Product is not owned by store'; end if;
    insert into public.merchant_model_submissions(store_id,product_id,object_path,original_name) values(sid,p_data->>'productId',path,left(p_data->>'name',200));
  else raise exception using errcode='22023',message='Invalid onboarding action'; end if;
  insert into public.merchant_growth_audit(actor_id,store_id,action) values(p_actor,sid,p_action);
  return public.read_merchant_growth(p_actor);
end$$;

create function public.merchant_wallet_action(p_actor uuid,p_kind text,p_quantity bigint,p_request uuid) returns jsonb
language plpgsql volatile security invoker set search_path='' as $$
declare sid text; balance jsonb; profile public.merchant_growth_profiles; price bigint; amount bigint; item uuid;
begin
  sid:=public.merchant_delivery_store(p_actor);
  perform pg_advisory_xact_lock(hashtextextended('merchant-growth:'||sid,0));
  if p_request is null then raise exception using errcode='22023',message='Request key required'; end if;
  if exists(select 1 from public.merchant_wallet_transactions where store_id=sid and request_key=p_request) then return public.read_merchant_growth(p_actor); end if;
  if p_quantity is null or p_quantity<1 or p_quantity>9007199254740991 then raise exception using errcode='22023',message='Invalid amount'; end if;
  select * into profile from public.merchant_growth_profiles where store_id=sid;
  if profile.verification_status is distinct from 'approved' then raise exception using errcode='P0021',message='Verified business required'; end if;
  if p_kind='withdrawal' then
    if profile.bank_status<>'approved' then raise exception using errcode='P0021',message='Verified bank account required'; end if;
    amount:=p_quantity;
  elsif p_kind='credits' then
    select credit_price_mnt into price from public.merchant_growth_settings where id=1 for share;
    if price<=0 or p_quantity>1000000 then raise exception using errcode='P0021',message='Credit sales are not configured'; end if;
    amount:=price*p_quantity;
  else raise exception using errcode='22023',message='Invalid wallet action'; end if;
  balance:=public.merchant_wallet_balance(sid);
  if amount>(balance->>'available')::bigint then raise exception using errcode='P0022',message='Insufficient wallet balance'; end if;
  insert into public.merchant_wallet_transactions(store_id,request_key,kind,amount,credits,status,bank_snapshot)
  values(sid,p_request,p_kind,amount,case when p_kind='credits' then p_quantity else 0 end,case when p_kind='credits' then 'completed' else 'pending' end,
    case when p_kind='withdrawal' then jsonb_build_object('bank',profile.bank_name,'account',profile.bank_account,'holder',profile.bank_holder) else '{}'::jsonb end) returning id into item;
  if p_kind='credits' then insert into public.merchant_credit_entries(store_id,request_key,delta,reason,actor_id) values(sid,'purchase:'||item,p_quantity,'Хэтэвчээс кредит авсан',p_actor); end if;
  insert into public.merchant_growth_audit(actor_id,store_id,action,details) values(p_actor,sid,p_kind,jsonb_build_object('transaction',item,'amount',amount::text));
  return public.read_merchant_growth(p_actor);
end$$;

create function public.admin_merchant_growth(p_actor uuid,p_action text default 'read',p_data jsonb default '{}'::jsonb) returns jsonb
language plpgsql volatile security invoker set search_path='' as $$
declare sid text; expected integer; decision text; action_id uuid; item public.merchant_wallet_transactions;
begin
  perform 1 from public.profiles where id=p_actor and role='admin' for share;
  if not found then raise insufficient_privilege; end if;
  sid:=p_data->>'storeId';
  if p_action<>'read' and p_action<>'settings' then
    if not exists(select 1 from public.merchant_stores where id=sid) then raise no_data_found; end if;
    perform pg_advisory_xact_lock(hashtextextended('merchant-growth:'||sid,0));
  end if;
  if p_action in ('verification','bank') then
    expected:=(p_data->>'version')::integer; decision:=p_data->>'status';
    if decision is null or decision not in ('approved','rejected') or expected is null then raise invalid_parameter_value; end if;
    if p_action='verification' then
      update public.merchant_growth_profiles set verification_status=decision,review_note=left(coalesce(p_data->>'note',''),1000),updated_at=now()
        where store_id=sid and verification_status='pending' and verification_version=expected and certificate_path is not null;
    else
      update public.merchant_growth_profiles set bank_status=decision,bank_note=left(coalesce(p_data->>'note',''),1000),updated_at=now()
        where store_id=sid and bank_status='pending' and bank_version=expected;
    end if;
    if not found then raise exception using errcode='P0003',message='Review changed; reload'; end if;
  elsif p_action='withdrawal' then
    action_id:=(p_data->>'id')::uuid; decision:=p_data->>'status';
    select * into item from public.merchant_wallet_transactions where id=action_id and store_id=sid and kind='withdrawal' for update;
    if not found or item.status<>'pending' then raise exception using errcode='P0003',message='Withdrawal changed'; end if;
    if decision is null or decision not in ('paid','rejected') then raise invalid_parameter_value; end if;
    if decision='paid' and (p_data->>'transferConfirmed' is distinct from 'true' or length(coalesce(p_data->>'reference',''))<3) then raise invalid_parameter_value; end if;
    update public.merchant_wallet_transactions set status=decision,reference=case when decision='paid' then p_data->>'reference' else null end,
      review_note=left(coalesce(p_data->>'note',''),1000),reviewed_by=p_actor,reviewed_at=now() where id=action_id;
  elsif p_action='grant' then
    if (p_data->>'credits')::bigint not between 1 and 1000000 or length(coalesce(p_data->>'reference',''))<3 then raise invalid_parameter_value; end if;
    insert into public.merchant_credit_entries(store_id,request_key,delta,reason,actor_id)
      values(sid,'grant:'||(p_data->>'requestKey')::uuid,(p_data->>'credits')::bigint,left(p_data->>'reference',200),p_actor) on conflict(store_id,request_key) do nothing;
  elsif p_action='settings' then
    update public.merchant_growth_settings set credit_price_mnt=(p_data->>'price')::bigint,background_credits=(p_data->>'background')::integer,
      render_credits=(p_data->>'render')::integer,model_credits=(p_data->>'model')::integer,updated_by=p_actor,updated_at=now() where id=1;
  elsif p_action='model' then
    decision:=p_data->>'status';
    if decision is null or decision not in ('accepted','rejected') then raise invalid_parameter_value; end if;
    update public.merchant_model_submissions set status=decision,review_note=left(coalesce(p_data->>'note',''),1000),reviewed_by=p_actor,reviewed_at=now()
      where id=(p_data->>'id')::uuid and store_id=sid and status='pending';
    if not found then raise exception using errcode='P0003',message='Submission changed'; end if;
  elsif p_action<>'read' then raise invalid_parameter_value; end if;
  if p_action<>'read' then insert into public.merchant_growth_audit(actor_id,store_id,action,details) values(p_actor,sid,'admin:'||p_action,p_data-'account'); end if;
  return jsonb_build_object(
    'profiles',coalesce((select jsonb_agg(to_jsonb(g)||jsonb_build_object('storeName',s.name) order by g.updated_at desc) from public.merchant_growth_profiles g join public.merchant_stores s on s.id=g.store_id),'[]'::jsonb),
    'withdrawals',coalesce((select jsonb_agg(to_jsonb(t)||jsonb_build_object('storeName',s.name) order by t.created_at desc) from (select * from public.merchant_wallet_transactions where kind='withdrawal' order by created_at desc limit 100) t join public.merchant_stores s on s.id=t.store_id),'[]'::jsonb),
    'models',coalesce((select jsonb_agg(to_jsonb(t)||jsonb_build_object('storeName',s.name) order by t.created_at desc) from (select * from public.merchant_model_submissions order by created_at desc limit 100) t join public.merchant_stores s on s.id=t.store_id),'[]'::jsonb),
    'settings',(select to_jsonb(g) from public.merchant_growth_settings g where id=1));
end$$;

create function public.merchant_growth_insights(p_actor uuid,p_days integer default 30) returns jsonb
language plpgsql volatile security invoker set search_path='' as $$
declare sid text; start_day date; result jsonb;
begin
  sid:=public.merchant_delivery_store(p_actor);
  if p_days is null or p_days not in (7,30,90) then raise invalid_parameter_value; end if;
  start_day:=(now() at time zone 'Asia/Ulaanbaatar')::date-p_days+1;
  with paid as materialized (
    select f.* from public.merchant_order_fulfillments f join public.orders o on o.id=f.order_id
    where f.store_id=sid and f.owner_id=p_actor and f.created_at>=start_day::timestamp at time zone 'Asia/Ulaanbaatar' and f.created_at<=now() and o.status<>'cancelled'
      and exists(select 1 from public.order_payments p where p.order_id=f.order_id and p.state='paid')
      and not exists(select 1 from public.order_cancellations c where c.order_id=f.order_id and c.status in ('approved','refunded'))
  ), daily as (
    select (created_at at time zone 'Asia/Ulaanbaatar')::date as day_key,sum(subtotal) gross,sum(merchant_net) net,count(*) orders from paid group by 1
  ), products as (
    select line->>'productId' id,max(line->>'name') name,sum((line->>'qty')::bigint) quantity,
      sum(coalesce((line->>'lineTotal')::bigint,(line->>'qty')::bigint*(line->>'unitPrice')::bigint)) revenue
    from paid cross join lateral jsonb_array_elements(items) line group by line->>'productId'
  ) select jsonb_build_object('days',p_days,'asOf',now(),
    'net',(select coalesce(sum(merchant_net),0)::text from paid),'gross',(select coalesce(sum(subtotal),0)::text from paid),'orders',(select count(*)::text from paid),
    'series',(select jsonb_agg(jsonb_build_object('date',d.day::date,'net',coalesce(s.net,0)::text,'gross',coalesce(s.gross,0)::text,'orders',coalesce(s.orders,0)::text) order by d.day)
      from generate_series(start_day::timestamp,(now() at time zone 'Asia/Ulaanbaatar')::date::timestamp,interval '1 day') d(day) left join daily s on s.day_key=d.day::date),
    'topRevenue',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'quantity',quantity::text,'revenue',revenue::text) order by revenue desc,id) from (select * from products order by revenue desc,id limit 5) p),'[]'::jsonb),
    'topQuantity',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'quantity',quantity::text,'revenue',revenue::text) order by quantity desc,id) from (select * from products order by quantity desc,id limit 5) p),'[]'::jsonb)
  ) into result;
  return result;
end$$;

revoke all on function public.merchant_growth_immutable(),public.merchant_wallet_protect(),public.resolve_merchant_store_link(text),public.merchant_wallet_balance(text),public.read_merchant_growth(uuid),public.save_merchant_growth(uuid,text,jsonb),public.merchant_wallet_action(uuid,text,bigint,uuid),public.admin_merchant_growth(uuid,text,jsonb),public.merchant_growth_insights(uuid,integer) from public,anon,authenticated;
grant execute on function public.resolve_merchant_store_link(text),public.merchant_wallet_balance(text),public.read_merchant_growth(uuid),public.save_merchant_growth(uuid,text,jsonb),public.merchant_wallet_action(uuid,text,bigint,uuid),public.admin_merchant_growth(uuid,text,jsonb),public.merchant_growth_insights(uuid,integer) to service_role;
notify pgrst,'reload schema';
