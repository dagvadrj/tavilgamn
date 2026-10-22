-- Server-only workflows: bounded atomic import, reconciliation report, versioned agreements.
create table public.merchant_product_imports (
  id uuid primary key default gen_random_uuid(),
  store_id text not null references public.merchant_stores(id),
  request_key uuid not null,
  content_hash text not null check(content_hash ~ '^[a-f0-9]{64}$'),
  row_count integer not null check(row_count between 1 and 500),
  product_ids jsonb not null check(jsonb_typeof(product_ids)='array'),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(store_id,request_key), unique(store_id,content_hash)
);
create index merchant_product_imports_actor_idx on public.merchant_product_imports(created_by);
create table public.merchant_contract_versions (
  id uuid primary key default gen_random_uuid(),
  version_no bigint generated always as identity unique,
  title text not null check(length(trim(title)) between 1 and 200),
  platform_name text not null check(length(trim(platform_name)) between 1 and 300),
  body text not null check(length(trim(body)) between 1 and 100000),
  status text not null default 'draft' check(status in ('draft','published')),
  revision integer not null default 0,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  check((status='published')=(published_at is not null))
);
create unique index merchant_contract_single_draft on public.merchant_contract_versions(status) where status='draft';
create index merchant_contract_versions_actor_idx on public.merchant_contract_versions(created_by);
create table public.merchant_contract_acceptances (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.merchant_contract_versions(id),
  store_id text not null references public.merchant_stores(id),
  accepted_by uuid not null references public.profiles(id),
  signer_name text not null check(length(trim(signer_name)) between 2 and 200),
  store_snapshot jsonb not null,
  commission_bps integer not null check(commission_bps between 0 and 10000),
  accepted_at timestamptz not null default now(),
  unique(store_id,contract_id)
);
create index merchant_contract_acceptances_contract_idx on public.merchant_contract_acceptances(contract_id);
create index merchant_contract_acceptances_actor_idx on public.merchant_contract_acceptances(accepted_by);
alter table public.merchant_product_imports enable row level security;
alter table public.merchant_contract_versions enable row level security;
alter table public.merchant_contract_acceptances enable row level security;
revoke all on public.merchant_product_imports,public.merchant_contract_versions,public.merchant_contract_acceptances from public,anon,authenticated,service_role;
grant select,insert on public.merchant_product_imports,public.merchant_contract_acceptances to service_role;
grant select,insert,update on public.merchant_contract_versions to service_role;
grant usage,select on sequence public.merchant_contract_versions_version_no_seq to service_role;

create function public.guard_merchant_contract() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_table_name='merchant_contract_acceptances' or tg_op='DELETE' then
    raise exception using errcode='22023',message='Contract evidence is immutable';
  end if;
  if old.status='published' then
    raise exception using errcode='22023',message='Contract evidence is immutable';
  end if;
  return new;
end $$;
create trigger immutable_contract_version before update or delete on public.merchant_contract_versions for each row execute function public.guard_merchant_contract();
create trigger immutable_contract_acceptance before update or delete on public.merchant_contract_acceptances for each row execute function public.guard_merchant_contract();

create function public.import_merchant_products(p_actor uuid,p_request uuid,p_hash text,p_products jsonb)
returns jsonb language plpgsql set search_path='' as $$
declare sid text; previous public.merchant_product_imports; product jsonb; ids jsonb:='[]';
begin
  perform 1 from public.profiles where id=p_actor and role='merchant' for share;
  if not found then raise exception using errcode='42501',message='Merchant required'; end if;
  -- Serializes retries and concurrent imports for the same store.
  select id into sid from public.merchant_stores where owner_id=p_actor and active for update;
  if not found then raise exception using errcode='42501',message='Active store required'; end if;
  if p_request is null or p_hash is null or p_hash !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(p_products) is distinct from 'array' or jsonb_array_length(p_products) not between 1 and 500 then
    raise exception using errcode='22023',message='Invalid import'; end if;
  select * into previous from public.merchant_product_imports where store_id=sid and request_key=p_request;
  if found and previous.content_hash<>p_hash then raise exception using errcode='P0003',message='Import request changed'; end if;
  if previous.id is null then
    select * into previous from public.merchant_product_imports where store_id=sid and content_hash=p_hash;
  end if;
  if previous.id is not null then
    return jsonb_build_object('id',previous.id,'count',previous.row_count,'replayed',true,'productIds',previous.product_ids);
  end if;
  for product in select value from jsonb_array_elements(p_products) loop
    if jsonb_typeof(product) is distinct from 'object' or product->>'category'='kitchen-cabinet' then
      raise exception using errcode='22023',message='Use dedicated kitchen library'; end if;
    -- Existing canonical save enforces ownership, dimensions, prices, protected fields and triggers.
    perform public.save_merchant_product_v2(p_actor,product,true,false,null);
    ids:=ids||jsonb_build_array(product->>'id');
  end loop;
  insert into public.merchant_product_imports(store_id,request_key,content_hash,row_count,product_ids,created_by)
    values(sid,p_request,p_hash,jsonb_array_length(p_products),ids,p_actor) returning * into previous;
  return jsonb_build_object('id',previous.id,'count',previous.row_count,'replayed',false,'productIds',ids);
end $$;

create function public.merchant_report(p_actor uuid,p_from date,p_to date)
returns jsonb language plpgsql set search_path='' as $$
declare s public.merchant_stores; rows jsonb; ledger jsonb; lo timestamptz; hi timestamptz;
begin
  perform 1 from public.profiles where id=p_actor and role='merchant' for share;
  if not found then raise exception using errcode='42501',message='Merchant required'; end if;
  select * into s from public.merchant_stores where owner_id=p_actor and active for share;
  if not found then raise exception using errcode='42501',message='Active store required'; end if;
  if p_from is null or p_to is null or p_to<p_from or p_to-p_from>365 then
    raise exception using errcode='22023',message='Invalid reporting period'; end if;
  lo:=p_from::timestamp at time zone 'Asia/Ulaanbaatar';
  hi:=(p_to+1)::timestamp at time zone 'Asia/Ulaanbaatar';
  if (select count(*) from public.merchant_order_fulfillments where store_id=s.id and created_at>=lo and created_at<hi)>5000
    or (select count(*) from public.merchant_wallet_transactions where store_id=s.id and created_at>=lo and created_at<hi)>5000 then
    raise exception using errcode='P0025',message='Choose a shorter reporting period'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'orderId',f.order_id,'createdAt',f.created_at,'day',(f.created_at at time zone 'Asia/Ulaanbaatar')::date,
    'orderStatus',o.status,'status',f.status,'stage',f.delivery_stage,
    'paid',exists(select 1 from public.order_payments p where p.order_id=o.id and p.state='paid'),
    'cancelled',o.status='cancelled' or exists(select 1 from public.order_cancellations c where c.order_id=o.id and c.status in ('approved','refunded')),
    'gross',f.subtotal::text,'fee',f.platform_fee::text,'net',f.merchant_net::text,
    'commissionBps',f.commission_bps,'items',f.items
  ) order by f.created_at,f.order_id),'[]') into rows
  from public.merchant_order_fulfillments f join public.orders o on o.id=f.order_id
  where f.store_id=s.id and f.created_at>=lo and f.created_at<hi;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'amount',amount::text,'credits',credits::text,
    'status',status,'reference',reference,'createdAt',created_at) order by created_at,id),'[]') into ledger
  from public.merchant_wallet_transactions where store_id=s.id and created_at>=lo and created_at<hi;
  return jsonb_build_object('storeId',s.id,'storeName',s.name,'from',p_from,'to',p_to,'generatedAt',now(),
    'orders',rows,'transactions',ledger,'wallet',public.merchant_wallet_balance(s.id));
end $$;

create function public.admin_merchant_contracts(p_actor uuid,p_action text default 'read',p_data jsonb default '{}')
returns jsonb language plpgsql set search_path='' as $$
declare target public.merchant_contract_versions; latest public.merchant_contract_versions; v integer; page_no integer;
begin
  perform 1 from public.profiles where id=p_actor and role='admin' for share;
  if not found then raise exception using errcode='42501',message='Admin required'; end if;
  if p_action='save' then
    perform pg_advisory_xact_lock(721661);
    select * into target from public.merchant_contract_versions where status='draft' for update;
    if (target.id is null and nullif(p_data->>'id','') is not null) or
      (target.id is not null and (target.id::text is distinct from p_data->>'id' or target.revision is distinct from (p_data->>'revision')::integer)) then
      raise exception using errcode='P0003',message='Draft changed'; end if;
    if length(trim(coalesce(p_data->>'title',''))) not between 1 and 200 or
      length(trim(coalesce(p_data->>'platformName',''))) not between 1 and 300 or
      length(trim(coalesce(p_data->>'body',''))) not between 1 and 100000 then
      raise exception using errcode='22023',message='Complete contract required'; end if;
    if target.id is null then
      insert into public.merchant_contract_versions(title,platform_name,body,created_by)
        values(trim(p_data->>'title'),trim(p_data->>'platformName'),trim(p_data->>'body'),p_actor) returning * into target;
    else
      update public.merchant_contract_versions set title=trim(p_data->>'title'),platform_name=trim(p_data->>'platformName'),
        body=trim(p_data->>'body'),revision=revision+1 where id=target.id returning * into target;
    end if;
  elsif p_action='publish' then
    perform pg_advisory_xact_lock(721661);
    select * into target from public.merchant_contract_versions where id=(p_data->>'id')::uuid and status='draft' for update;
    if not found or target.revision is distinct from (p_data->>'revision')::integer then
      raise exception using errcode='P0003',message='Draft changed'; end if;
    update public.merchant_contract_versions set status='published',published_at=now(),revision=revision+1
      where id=target.id returning * into target;
  elsif p_action<>'read' then raise exception using errcode='22023',message='Unknown operation';
  end if;
  page_no:=coalesce((p_data->>'page')::integer,0);
  if page_no<0 or page_no>100000 then raise exception using errcode='22023',message='Invalid page'; end if;
  return jsonb_build_object('versions',coalesce((select jsonb_agg(to_jsonb(x) order by version_no desc)
    from (select * from public.merchant_contract_versions order by version_no desc limit 30) x),'[]'),
    'acceptances',coalesce((select jsonb_agg(to_jsonb(x)) from (select a.id,a.contract_id,a.store_id,a.signer_name,a.accepted_at,
      a.store_snapshot,a.commission_bps,v.version_no from public.merchant_contract_acceptances a
      join public.merchant_contract_versions v on v.id=a.contract_id order by a.accepted_at desc,a.id limit 51 offset page_no*50) x),'[]'));
end $$;

create function public.merchant_contracts(p_actor uuid,p_action text default 'read',p_data jsonb default '{}')
returns jsonb language plpgsql set search_path='' as $$
declare s public.merchant_stores; target public.merchant_contract_versions; accepted public.merchant_contract_acceptances;
begin
  perform 1 from public.profiles where id=p_actor and role='merchant' for share;
  if not found then raise exception using errcode='42501',message='Merchant required'; end if;
  select * into s from public.merchant_stores where owner_id=p_actor and active for share;
  if not found then raise exception using errcode='42501',message='Active store required'; end if;
  -- Publishing and accepting serialize so an obsolete revision cannot be accepted as current.
  perform pg_advisory_xact_lock(721661);
  select * into target from public.merchant_contract_versions where status='published' order by version_no desc limit 1;
  if p_action='accept' then
    if target.id is null or target.id::text is distinct from p_data->>'contractId' then
      raise exception using errcode='P0003',message='Contract changed'; end if;
    if (p_data->>'consent') is distinct from 'true' or length(trim(coalesce(p_data->>'signerName',''))) not between 2 and 200 then
      raise exception using errcode='22023',message='Name and explicit consent required'; end if;
    insert into public.merchant_contract_acceptances(contract_id,store_id,accepted_by,signer_name,store_snapshot,commission_bps)
      values(target.id,s.id,p_actor,trim(p_data->>'signerName'),jsonb_build_object('name',s.name,'address',s.address,
        'phone',s.phone,'legalName',(select legal_name from public.merchant_growth_profiles where store_id=s.id)),s.commission_bps)
      on conflict(store_id,contract_id) do nothing;
  elsif p_action<>'read' then raise exception using errcode='22023',message='Unknown operation';
  end if;
  return jsonb_build_object('current',case when target.id is null then null else to_jsonb(target) end,
    'acceptances',coalesce((select jsonb_agg(jsonb_build_object('acceptance',to_jsonb(a),'contract',to_jsonb(v))
      order by a.accepted_at desc) from public.merchant_contract_acceptances a
      join public.merchant_contract_versions v on v.id=a.contract_id where a.store_id=s.id),'[]'));
end $$;
revoke all on function public.guard_merchant_contract(),public.import_merchant_products(uuid,uuid,text,jsonb),
  public.merchant_report(uuid,date,date),public.admin_merchant_contracts(uuid,text,jsonb),public.merchant_contracts(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.guard_merchant_contract(),public.import_merchant_products(uuid,uuid,text,jsonb),
  public.merchant_report(uuid,date,date),public.admin_merchant_contracts(uuid,text,jsonb),public.merchant_contracts(uuid,text,jsonb) to service_role;

create function public.merchant_product_export(p_actor uuid,p_category text default '',p_search text default '',p_archived boolean default false)
returns setof public.furniture_models language plpgsql set search_path='' as $$
declare sid text;
begin
  perform 1 from public.profiles where id=p_actor and role='merchant' for share;
  if not found then raise exception using errcode='42501',message='Merchant required'; end if;
  select id into sid from public.merchant_stores where owner_id=p_actor and active for share;
  if not found then raise exception using errcode='42501',message='Active store required'; end if;
  if p_category is null or p_search is null or length(p_search)>100 or p_archived is null then
    raise exception using errcode='22023',message='Invalid export filter'; end if;
  if (select count(*) from public.furniture_models where store_ids=jsonb_build_array(sid)
    and (p_archived or archived_at is null) and (p_category='' or category=p_category)
    and strpos(lower(name),lower(p_search))>0)>5000 then
    raise exception using errcode='P0025',message='Narrow product filters'; end if;
  return query select f.* from public.furniture_models f where store_ids=jsonb_build_array(sid)
    and (p_archived or archived_at is null) and (p_category='' or category=p_category)
    and strpos(lower(name),lower(p_search))>0 order by name,product_id;
end $$;
revoke all on function public.merchant_product_export(uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.merchant_product_export(uuid,text,text,boolean) to service_role;
