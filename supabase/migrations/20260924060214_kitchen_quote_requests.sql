create table public.kitchen_quote_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete restrict,
  store_id text not null references public.merchant_stores(id) on delete restrict,
  merchant_owner_id uuid not null references auth.users(id) on delete restrict,
  design_id uuid not null,
  version_id uuid not null,
  project_id uuid,
  idempotency_key uuid not null,
  project_name text not null check(char_length(btrim(project_name)) between 1 and 160),
  project_snapshot jsonb not null check(
    jsonb_typeof(project_snapshot)='object' and
    jsonb_typeof(project_snapshot->'cabinets')='array' and
    jsonb_array_length(project_snapshot->'cabinets') between 1 and 80 and
    octet_length(project_snapshot::text)<=250000
  ),
  contact_name text not null check(char_length(btrim(contact_name)) between 2 and 100),
  contact_phone text not null check(char_length(btrim(contact_phone)) between 4 and 50),
  contact_email text not null check(char_length(contact_email) between 3 and 254),
  customer_message text not null default '' check(char_length(customer_message)<=3000),
  room_details jsonb not null default '{}' check(
    jsonb_typeof(room_details)='object' and octet_length(room_details::text)<=5000
  ),
  status text not null default 'submitted'
    check(status in ('submitted','reviewing','quoted','closed')),
  quoted_price bigint check(quoted_price is null or quoted_price between 0 and 9007199254740991),
  merchant_note text not null default '' check(char_length(merchant_note)<=5000),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(customer_id,idempotency_key),
  foreign key(design_id,version_id)
    references public.kitchen_design_versions(design_id,id) on delete restrict,
  foreign key(customer_id,project_id)
    references public.kitchen_garnitures(user_id,id) on delete set null (project_id)
);

create index kitchen_quotes_merchant_status_created_idx
  on public.kitchen_quote_requests(merchant_owner_id,status,created_at desc,id desc);
create index kitchen_quotes_customer_created_idx
  on public.kitchen_quote_requests(customer_id,created_at desc,id desc);
create index kitchen_quotes_design_created_idx
  on public.kitchen_quote_requests(design_id,created_at desc,id desc);

alter table public.kitchen_quote_requests enable row level security;
revoke all on public.kitchen_quote_requests from public,anon,authenticated;
grant all on public.kitchen_quote_requests to service_role;
create policy kitchen_quote_requests_private on public.kitchen_quote_requests
  for all to anon,authenticated using(false) with check(false);

alter table public.user_notifications drop constraint user_notifications_kind_check;
alter table public.user_notifications add constraint user_notifications_kind_check
  check(kind in ('kitchen_review','kitchen_quote'));

create function public.create_kitchen_quote_request(
  p_actor uuid,
  p_design uuid,
  p_project uuid,
  p_idempotency uuid,
  p_contact jsonb,
  p_room jsonb,
  p_message text
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  target_store text;
  target_owner uuid;
  target_version uuid;
  snapshot jsonb;
  snapshot_name text;
  saved public.kitchen_quote_requests;
begin
  perform 1 from auth.users where id=p_actor for share;
  if not found then raise exception using errcode='42501',message='Authenticated user required'; end if;

  select d.store_id,s.owner_id,d.published_version_id,v.design,v.title
    into target_store,target_owner,target_version,snapshot,snapshot_name
  from public.kitchen_designs d
  join public.kitchen_design_versions v
    on v.design_id=d.id and v.id=d.published_version_id
  join public.merchant_stores s on s.id=d.store_id and s.active
  join public.profiles p on p.id=s.owner_id and p.role='merchant'
  where d.id=p_design and d.publication_status='published'
    and v.review_status='approved' and s.store_type in ('factory','handmade')
  for share of d,v,s,p;
  if not found then raise exception using errcode='P0002',message='Published kitchen design not found'; end if;

  if p_project is not null then
    select g.design,g.name,g.source_marketplace_version_id
      into snapshot,snapshot_name,target_version
    from public.kitchen_garnitures g
    join public.kitchen_design_versions v
      on v.design_id=g.source_marketplace_design_id
      and v.id=g.source_marketplace_version_id
      and v.review_status='approved'
    where g.user_id=p_actor and g.id=p_project
      and g.source_marketplace_design_id=p_design
    for share of g,v;
    if not found then raise exception using errcode='P0002',message='Kitchen project not found'; end if;
  end if;

  if jsonb_typeof(p_contact) is distinct from 'object'
    or char_length(btrim(coalesce(p_contact->>'name',''))) not between 2 and 100
    or char_length(btrim(coalesce(p_contact->>'phone',''))) not between 4 and 50
    or char_length(lower(btrim(coalesce(p_contact->>'email','')))) not between 3 and 254
    or lower(btrim(p_contact->>'email')) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or jsonb_typeof(p_room) is distinct from 'object'
    or octet_length(p_room::text)>5000
    or char_length(coalesce(p_message,''))>3000 then
    raise exception using errcode='22023',message='Invalid kitchen quote details';
  end if;

  insert into public.kitchen_quote_requests(
    customer_id,store_id,merchant_owner_id,design_id,version_id,project_id,
    idempotency_key,project_name,project_snapshot,contact_name,contact_phone,
    contact_email,customer_message,room_details
  ) values(
    p_actor,target_store,target_owner,p_design,target_version,p_project,
    p_idempotency,snapshot_name,snapshot,btrim(p_contact->>'name'),
    btrim(p_contact->>'phone'),lower(btrim(p_contact->>'email')),
    coalesce(p_message,''),p_room
  ) on conflict(customer_id,idempotency_key) do nothing;

  select * into saved from public.kitchen_quote_requests
  where customer_id=p_actor and idempotency_key=p_idempotency;
  if not found or saved.design_id is distinct from p_design
    or saved.project_id is distinct from p_project then
    raise exception using errcode='P0013',message='Kitchen quote idempotency conflict';
  end if;

  insert into public.user_notifications(
    user_id,kind,title,body,href,entity_id,source_key,metadata
  ) values(
    target_owner,'kitchen_quote','Шинэ гал тогооны үнийн хүсэлт',
    saved.project_name||' загварт шинэ хүсэлт ирлээ.',
    '/merchant?tab=quotes',saved.id,'kitchen-quote:'||saved.id,
    jsonb_build_object('designId',p_design,'quoteId',saved.id,'storeId',target_store)
  ) on conflict(source_key) do nothing;

  return jsonb_build_object(
    'id',saved.id,'status',saved.status,'createdAt',saved.created_at
  );
end;
$$;

create function public.read_merchant_kitchen_quotes(
  p_actor uuid,p_page integer default 0
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare target_store text; result jsonb;
begin
  if p_page is null or p_page<0 or p_page>100000 then
    raise exception using errcode='22023',message='Invalid page';
  end if;
  perform 1 from public.profiles where id=p_actor and role='merchant' for share;
  if not found then raise exception using errcode='42501',message='Merchant required'; end if;
  select id into target_store from public.merchant_stores
    where owner_id=p_actor and active for share;
  if not found then return '[]'::jsonb; end if;

  select coalesce(jsonb_agg(page.row),'[]'::jsonb) into result from (
    select jsonb_build_object(
      'id',q.id,'designId',q.design_id,'versionId',q.version_id,
      'projectId',q.project_id,'projectName',q.project_name,
      'contactName',q.contact_name,'contactPhone',q.contact_phone,
      'contactEmail',q.contact_email,'customerMessage',q.customer_message,
      'roomDetails',q.room_details,'status',q.status,
      'quotedPrice',q.quoted_price,'merchantNote',q.merchant_note,
      'cabinetCount',jsonb_array_length(q.project_snapshot->'cabinets'),
      'thumbnailUrl',(
        select m.url from public.kitchen_design_media m
        where m.version_id=q.version_id and m.kind='thumbnail'
          and m.is_primary and m.status='ready'
        order by m.sort_order,m.id limit 1
      ),
      'createdAt',q.created_at,'updatedAt',q.updated_at
    ) row
    from public.kitchen_quote_requests q
    where q.merchant_owner_id=p_actor and q.store_id=target_store
    order by q.created_at desc,q.id desc offset p_page*20 limit 21
  ) page;
  return result;
end;
$$;

create function public.read_customer_kitchen_quotes(
  p_actor uuid,p_page integer default 0
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
  if p_page is null or p_page<0 or p_page>100000 then
    raise exception using errcode='22023',message='Invalid page';
  end if;
  perform 1 from auth.users where id=p_actor for share;
  if not found then raise exception using errcode='42501',message='Authenticated user required'; end if;

  select coalesce(jsonb_agg(page.row),'[]'::jsonb) into result from (
    select jsonb_build_object(
      'id',q.id,'designId',q.design_id,'projectId',q.project_id,
      'designSlug',d.slug,'projectName',q.project_name,'storeName',s.name,
      'status',q.status,'quotedPrice',q.quoted_price,
      'merchantNote',q.merchant_note,'createdAt',q.created_at,'updatedAt',q.updated_at
    ) row
    from public.kitchen_quote_requests q
    join public.kitchen_designs d on d.id=q.design_id
    join public.merchant_stores s on s.id=q.store_id
    where q.customer_id=p_actor
    order by q.created_at desc,q.id desc offset p_page*20 limit 21
  ) page;
  return result;
end;
$$;

create function public.update_merchant_kitchen_quote(
  p_actor uuid,p_quote uuid,p_status text,p_expected_status text,
  p_price bigint,p_note text
) returns void language plpgsql security invoker set search_path='' as $$
declare target_store text; current_quote public.kitchen_quote_requests;
begin
  perform 1 from public.profiles where id=p_actor and role='merchant' for share;
  if not found then raise exception using errcode='42501',message='Merchant required'; end if;
  select id into target_store from public.merchant_stores
    where owner_id=p_actor and active for share;
  if not found then raise exception using errcode='42501',message='Active store required'; end if;

  select * into current_quote from public.kitchen_quote_requests
  where id=p_quote and merchant_owner_id=p_actor and store_id=target_store for update;
  if not found then raise exception using errcode='P0002',message='Kitchen quote not found'; end if;
  if current_quote.status is distinct from p_expected_status then
    raise exception using errcode='P0015',message='Kitchen quote changed';
  end if;
  if char_length(coalesce(p_note,''))>5000
    or p_status not in ('reviewing','quoted','closed')
    or (p_status='reviewing' and current_quote.status<>'submitted')
    or (p_status='quoted' and (current_quote.status not in ('submitted','reviewing') or p_price is null or p_price<0))
    or (p_status='closed' and current_quote.status='closed') then
    raise exception using errcode='22023',message='Invalid kitchen quote transition';
  end if;

  update public.kitchen_quote_requests set
    status=p_status,
    quoted_price=case when p_status='quoted' then p_price else quoted_price end,
    merchant_note=coalesce(p_note,''),
    responded_at=case when p_status in ('quoted','closed') then now() else responded_at end,
    updated_at=now()
  where id=p_quote;

  insert into public.user_notifications(
    user_id,kind,title,body,href,entity_id,source_key,metadata
  ) values(
    current_quote.customer_id,'kitchen_quote',
    case p_status when 'reviewing' then 'Үнийн хүсэлтийг шалгаж байна'
      when 'quoted' then 'Гал тогооны үнийн санал бэлэн боллоо'
      else 'Гал тогооны үнийн хүсэлт хаагдлаа' end,
    coalesce(p_note,''),'/account#kitchen-quotes',current_quote.id,
    'kitchen-quote:'||current_quote.id||':'||p_status,
    jsonb_build_object('designId',current_quote.design_id,'quoteId',current_quote.id,'status',p_status)
  ) on conflict(source_key) do nothing;
end;
$$;

revoke all on function public.create_kitchen_quote_request(uuid,uuid,uuid,uuid,jsonb,jsonb,text),
  public.read_merchant_kitchen_quotes(uuid,integer),
  public.read_customer_kitchen_quotes(uuid,integer),
  public.update_merchant_kitchen_quote(uuid,uuid,text,text,bigint,text)
  from public,anon,authenticated;
grant execute on function public.create_kitchen_quote_request(uuid,uuid,uuid,uuid,jsonb,jsonb,text),
  public.read_merchant_kitchen_quotes(uuid,integer),
  public.read_customer_kitchen_quotes(uuid,integer),
  public.update_merchant_kitchen_quote(uuid,uuid,text,text,bigint,text)
  to service_role;

notify pgrst,'reload schema';
