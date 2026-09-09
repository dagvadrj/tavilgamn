-- Canonical catalog: furniture_models. in_stock is available units, never a boolean.
-- Apply once to the current products/furniture_models schema before deploying the code.
begin;

-- Retire only legacy catalog synchronization triggers, preserving unrelated triggers.
do $$ declare item record; begin
  for item in select t.tgname from pg_trigger t join pg_proc f on f.oid=t.tgfoid
    where t.tgrelid='public.furniture_models'::regclass and not t.tgisinternal
      and pg_get_functiondef(f.oid) ~ '\mproducts\M'
  loop execute format('drop trigger %I on public.furniture_models',item.tgname); end loop;
end $$;

alter table public.furniture_models
  add column if not exists product_id text,
  add column if not exists image_url text,
  add column if not exists default_color text,
  add column if not exists rating numeric not null default 0,
  add column if not exists review_count integer not null default 0,
  add column if not exists badges jsonb not null default '[]',
  add column if not exists is_new boolean not null default false,
  add column if not exists is_best_seller boolean not null default false,
  add column if not exists store_ids jsonb not null default '[]',
  add column if not exists updated_at timestamptz not null default now();
alter table public.furniture_models alter column glb_path drop not null;
alter table public.furniture_models alter column in_stock drop default;
alter table public.furniture_models alter column in_stock drop not null;
do $$ begin
  if (select data_type from information_schema.columns where table_schema='public' and table_name='furniture_models' and column_name='in_stock') = 'boolean' then
    -- True does not reveal a physical count. Leave it uncounted instead of inventing stock.
    alter table public.furniture_models alter column in_stock type integer using (case when in_stock = false then 0 else null end);
  else
    alter table public.furniture_models alter column in_stock type integer using in_stock::integer;
  end if;
end $$;
alter table public.furniture_models alter column in_stock set default 0;
alter table public.furniture_models add constraint furniture_stock_range check(in_stock between 0 and 1000000);

update public.furniture_models m set product_id = coalesce(m.catalog_product_id,
  (select p.id from public.products p where p.data#>>'{model,id}'=m.id::text or p.id=m.id::text order by p.id limit 1),m.id::text)
  where product_id is null;

-- Preserve all catalog metadata on the existing model row, including its GLB storage path.
update public.furniture_models m set
  name=p.data->>'name', category=p.data->>'category', description=coalesce(p.data->>'description',''),
  base_price=(p.data->>'basePrice')::bigint, image_url=p.data->>'image',
  dimensions_w=(p.data#>>'{dimensions,w}')::double precision,
  dimensions_d=(p.data#>>'{dimensions,d}')::double precision,
  dimensions_h=(p.data#>>'{dimensions,h}')::double precision,
  colors=p.data->'colors', materials=p.data->'materials', default_color=p.data->>'defaultColor',
  rating=coalesce((p.data->>'rating')::numeric,0), review_count=coalesce((p.data->>'reviewCount')::integer,0),
  badges=coalesce(p.data->'badges','[]'), is_new=coalesce((p.data->>'isNew')::boolean,false),
  is_best_seller=coalesce((p.data->>'isBestSeller')::boolean,false), store_ids=coalesce(p.data->'storeIds','[]'),
  in_stock=coalesce(m.in_stock,(p.data->>'stockQuantity')::integer,case when p.data->>'inStock'='false' then 0 end)
from public.products p where p.id=m.product_id;

-- Products without a GLB still have a furniture_models row. Existing public IDs survive.
insert into public.furniture_models(id,product_id,name,category,description,base_price,image_url,glb_path,scale,
  dimensions_w,dimensions_d,dimensions_h,colors,materials,default_color,in_stock,rating,review_count,badges,is_new,is_best_seller,store_ids)
select gen_random_uuid(),p.id,p.data->>'name',p.data->>'category',coalesce(p.data->>'description',''),
  (p.data->>'basePrice')::bigint,p.data->>'image',null,1,
  (p.data#>>'{dimensions,w}')::double precision,(p.data#>>'{dimensions,d}')::double precision,(p.data#>>'{dimensions,h}')::double precision,
  p.data->'colors',p.data->'materials',p.data->>'defaultColor',
  coalesce((p.data->>'stockQuantity')::integer,case when p.data->>'inStock'='false' then 0 end),
  coalesce((p.data->>'rating')::numeric,0),coalesce((p.data->>'reviewCount')::integer,0),coalesce(p.data->'badges','[]'),
  coalesce((p.data->>'isNew')::boolean,false),coalesce((p.data->>'isBestSeller')::boolean,false),coalesce(p.data->'storeIds','[]')
from public.products p where not exists(select 1 from public.furniture_models m where m.product_id=p.id);

update public.furniture_models set default_color=colors->0->>'id' where default_color is null;
alter table public.furniture_models alter column product_id set not null;
alter table public.furniture_models add constraint furniture_product_id_unique unique(product_id);
alter table public.furniture_models add constraint furniture_product_id_format check(product_id ~ '^[a-zA-Z0-9_-]{1,100}$');

-- A private backup preserves the original data; the application no longer reads/writes it.
alter table public.furniture_models drop column catalog_product_id;
alter table public.products rename to products_legacy_backup;
revoke all on public.products_legacy_backup from anon, authenticated, service_role;
do $$ declare item record; begin
  for item in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('save_catalog_product','set_product_glb','replace_model_glb','migrate_model_glb_r2')
  loop execute format('revoke all on function %s from public, anon, authenticated, service_role',item.signature); end loop;
end $$;

create function public.save_furniture_product(p_data jsonb,p_create boolean,p_expected_stock integer default null)
returns void language plpgsql security invoker set search_path='' as $$
declare target_id uuid; current_stock integer;
begin
  if jsonb_typeof(p_data->'stockQuantity') is distinct from 'number' or p_data->>'stockQuantity' !~ '^[0-9]+$'
    or (p_data->>'stockQuantity')::numeric > 1000000 then
    raise exception using errcode='22023', message='Invalid stock quantity';
  end if;
  if p_create then
    insert into public.furniture_models(id,product_id,name,category,description,base_price,glb_path,scale,
      dimensions_w,dimensions_d,dimensions_h,colors,materials,in_stock)
    values(gen_random_uuid(),p_data->>'id',p_data->>'name',p_data->>'category',coalesce(p_data->>'description',''),
      (p_data->>'basePrice')::bigint,null,1,(p_data#>>'{dimensions,w}')::double precision,
      (p_data#>>'{dimensions,d}')::double precision,(p_data#>>'{dimensions,h}')::double precision,
      p_data->'colors',p_data->'materials',(p_data->>'stockQuantity')::integer) returning id into target_id;
  else
    select id,in_stock into target_id,current_stock from public.furniture_models where product_id=p_data->>'id' for update;
    if not found then raise exception using errcode='P0002',message='Product not found'; end if;
    if current_stock is distinct from p_expected_stock then raise exception using errcode='P0003',message='Stock changed'; end if;
  end if;
  update public.furniture_models set name=p_data->>'name',category=p_data->>'category',description=coalesce(p_data->>'description',''),
    base_price=(p_data->>'basePrice')::bigint,image_url=p_data->>'image',colors=p_data->'colors',materials=p_data->'materials',
    default_color=p_data->>'defaultColor',dimensions_w=(p_data#>>'{dimensions,w}')::double precision,
    dimensions_d=(p_data#>>'{dimensions,d}')::double precision,dimensions_h=(p_data#>>'{dimensions,h}')::double precision,
    in_stock=(p_data->>'stockQuantity')::integer,rating=coalesce((p_data->>'rating')::numeric,0),
    review_count=coalesce((p_data->>'reviewCount')::integer,0),badges=coalesce(p_data->'badges','[]'),
    is_new=coalesce((p_data->>'isNew')::boolean,false),is_best_seller=coalesce((p_data->>'isBestSeller')::boolean,false),
    store_ids=coalesce(p_data->'storeIds','[]'),updated_at=now() where id=target_id;
end $$;
revoke all on function public.save_furniture_product(jsonb,boolean,integer) from public,anon,authenticated;
grant execute on function public.save_furniture_product(jsonb,boolean,integer) to service_role;

create function public.replace_furniture_glb(p_id uuid,p_expected_file text,p_new text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare current_path text;
begin
  if p_new !~ ('^r2://[a-z0-9-]+/models/' || p_id::text || '/model-[0-9a-f-]+[.]glb$') then raise exception 'Invalid model path'; end if;
  select glb_path into current_path from public.furniture_models where id=p_id for update;
  if not found or coalesce(regexp_replace(current_path,'^.*/',''),'') is distinct from p_expected_file then return false; end if;
  update public.furniture_models set glb_path=p_new,updated_at=now() where id=p_id;
  return true;
end $$;
revoke all on function public.replace_furniture_glb(uuid,text,text) from public,anon,authenticated;
grant execute on function public.replace_furniture_glb(uuid,text,text) to service_role;

alter table public.orders add column stock_reserved boolean not null default false;
create function public.reserve_order_stock()
returns trigger language plpgsql security invoker set search_path='' as $$
declare selection record; furniture public.furniture_models; line jsonb; current_price bigint;
begin
  for selection in select x->>'productId' as id,sum((x->>'qty')::integer) as qty
    from jsonb_array_elements(new.items) x group by x->>'productId' order by x->>'productId'
  loop
    select * into furniture from public.furniture_models where product_id=selection.id for update;
    if not found or selection.qty < 1 or coalesce(furniture.in_stock,0) < selection.qty then
      raise exception using errcode='P0004',message='Insufficient stock';
    end if;
    for line in select x from jsonb_array_elements(new.items) x where x->>'productId'=selection.id loop
      select furniture.base_price + coalesce((c->>'priceDelta')::bigint,0) + (m->>'priceDelta')::bigint into current_price
        from jsonb_array_elements(furniture.colors) c,jsonb_array_elements(furniture.materials) m
        where c->>'id'=line->>'color' and m->>'id'=line->>'material';
      if not found or current_price is distinct from (line->>'unitPrice')::bigint then
        raise exception using errcode='P0005',message='Catalog price changed';
      end if;
      if (line->>'qty')::integer not between 1 and 99 then raise exception using errcode='22023',message='Invalid quantity'; end if;
    end loop;
    update public.furniture_models set in_stock=in_stock-selection.qty,updated_at=now() where id=furniture.id;
  end loop;
  new.stock_reserved:=true;
  return new;
end $$;
create trigger reserve_order_stock before insert on public.orders for each row execute function public.reserve_order_stock();
create function public.release_cancelled_order_stock()
returns trigger language plpgsql security invoker set search_path='' as $$
declare selection record;
begin
  if old.stock_reserved and new.items is distinct from old.items then raise exception 'Reserved items are immutable'; end if;
  if old.status='cancelled' and new.status<>'cancelled' then raise exception 'Cancelled orders cannot be reopened'; end if;
  new.stock_reserved:=old.stock_reserved;
  if old.stock_reserved and old.status<>'cancelled' and new.status='cancelled' then
    for selection in select x->>'productId' as id,sum((x->>'qty')::integer) as qty
      from jsonb_array_elements(old.items) x group by x->>'productId' order by x->>'productId'
    loop
      update public.furniture_models set in_stock=coalesce(in_stock,0)+selection.qty,updated_at=now() where product_id=selection.id;
    end loop;
    new.stock_reserved:=false;
  end if;
  return new;
end $$;
create trigger release_cancelled_order_stock before update on public.orders for each row execute function public.release_cancelled_order_stock();

create function public.protect_ordered_furniture() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if exists(select 1 from public.orders o where o.stock_reserved and o.items @> jsonb_build_array(jsonb_build_object('productId',old.product_id))) then
    raise exception using errcode='P0007',message='Product belongs to a reserved order';
  end if;
  return old;
end $$;
create trigger protect_ordered_furniture before delete on public.furniture_models for each row execute function public.protect_ordered_furniture();


create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  email text not null check (char_length(email) between 3 and 254),
  message text not null check (char_length(message) between 10 and 5000),
  created_at timestamptz not null default now()
);
create index contact_messages_created_idx on public.contact_messages(created_at desc, id desc);
create index contact_messages_email_created_idx on public.contact_messages(email, created_at desc);
alter table public.contact_messages enable row level security;
revoke all on public.contact_messages from anon, authenticated;
grant all on public.contact_messages to service_role;

create or replace function public.submit_contact_message(p_name text, p_email text, p_message text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare result uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(lower(p_email), 0));
  if (select count(*) from public.contact_messages where email = lower(p_email) and created_at > now() - interval '15 minutes') >= 5 then
    raise exception using errcode = 'P0006', message = 'Too many messages';
  end if;
  insert into public.contact_messages(name,email,message) values(p_name,lower(p_email),p_message) returning id into result;
  return result;
end;
$$;
revoke all on function public.submit_contact_message(text,text,text) from public, anon, authenticated;
grant execute on function public.submit_contact_message(text,text,text) to service_role;

notify pgrst, 'reload schema';
commit;
