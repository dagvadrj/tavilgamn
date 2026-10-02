-- Additive Phase 5 product commerce and media lifecycle; no objects are purged.
begin;

alter table public.furniture_models
  add column compare_at_price bigint,
  add column promotion_label text,
  add column promotion_ends_at timestamptz,
  add column delivery_terms text,
  add constraint furniture_reference_price check(compare_at_price is null or (compare_at_price > base_price and compare_at_price <= 9007199254740991)),
  add constraint furniture_promotion_label check(promotion_label is null or (length(btrim(promotion_label)) between 1 and 80 and compare_at_price is not null)),
  add constraint furniture_promotion_expiry check(promotion_ends_at is null or compare_at_price is not null),
  add constraint furniture_delivery_terms check(delivery_terms is null or length(btrim(delivery_terms)) between 1 and 1000);

create table public.product_media_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  public_id text not null unique check(length(public_id) between 1 and 500),
  url text unique check(url is null or url like 'https://res.cloudinary.com/%'),
  state text not null default 'uploading' check(state in ('uploading','ready','attached','retained','failed')),
  created_at timestamptz not null default now(),
  retired_at timestamptz,
  constraint product_media_ready_url check(state in ('uploading','failed') or url is not null)
);
create index product_media_owner_idx on public.product_media_assets(owner_id);
create index product_media_reconcile_idx on public.product_media_assets(created_at) where state in ('uploading','ready','failed');
create table public.product_media_refs (
  model_id uuid not null references public.furniture_models(id) on delete restrict,
  asset_id uuid not null references public.product_media_assets(id) on delete restrict,
  primary key(model_id,asset_id)
);
create index product_media_refs_asset_idx on public.product_media_refs(asset_id);
alter table public.product_media_assets enable row level security;
alter table public.product_media_refs enable row level security;
revoke all on public.product_media_assets,public.product_media_refs from public,anon,authenticated;
grant select,insert,update on public.product_media_assets to service_role;
grant select,insert,update,delete on public.product_media_refs to service_role;
comment on table public.product_media_assets is 'Private upload ledger registered before Cloudinary PUT. Failed/abandoned assets are reconciled manually; retained history is never automatically purged.';

create function public.sync_product_media_refs() returns trigger
language plpgsql security invoker set search_path='' as $$
declare image text; asset public.product_media_assets; merchant_owner uuid; old_asset uuid;
begin
  select s.owner_id into merchant_owner from public.merchant_stores s where new.store_ids=jsonb_build_array(s.id);
  perform 1 from public.product_media_assets a where a.id in (select asset_id from public.product_media_refs where model_id=new.id)
    or a.url=new.image_url or a.url in (select jsonb_array_elements_text(new.images)) order by a.id for update;
  -- Keep removed pictures as retained history, not untracked external orphans.
  for old_asset in select asset_id from public.product_media_refs where model_id=new.id loop
    delete from public.product_media_refs where model_id=new.id and asset_id=old_asset;
    update public.product_media_assets set state='retained',retired_at=coalesce(retired_at,now())
      where id=old_asset and not exists(select 1 from public.product_media_refs r where r.asset_id=old_asset);
  end loop;
  for image in select new.image_url union select jsonb_array_elements_text(new.images) loop
    select * into asset from public.product_media_assets where url=image for update;
    if found then
      if asset.owner_id is distinct from merchant_owner or asset.state not in ('ready','attached','retained') then
        raise exception using errcode='22023',message='Product media belongs to a different owner or is not ready';
      end if;
      insert into public.product_media_refs(model_id,asset_id) values(new.id,asset.id) on conflict do nothing;
      update public.product_media_assets set state='attached',retired_at=null where id=asset.id;
    end if;
  end loop;
  return new;
end $$;
revoke all on function public.sync_product_media_refs() from public,anon,authenticated;
create trigger sync_product_media_refs after insert or update of image_url,images,store_ids on public.furniture_models
  for each row execute function public.sync_product_media_refs();

-- Preserve the existing stock CAS and platform fields while extending metadata.
alter function public.save_furniture_product(jsonb,boolean,integer) rename to save_furniture_product_pre_phase5;
create function public.save_furniture_product(p_data jsonb,p_create boolean,p_expected_stock integer default null)
returns void language plpgsql security invoker set search_path='' as $$
declare reference_price bigint; label text; expires timestamptz; terms text;
begin
  if p_data->>'compareAtPrice' is not null then
    if jsonb_typeof(p_data->'compareAtPrice')<>'number' or p_data->>'compareAtPrice' !~ '^[0-9]+$' then
      raise exception using errcode='22023',message='Invalid reference price';
    end if;
    reference_price:=(p_data->>'compareAtPrice')::bigint;
  end if;
  label:=nullif(btrim(p_data->>'promotionLabel'),'');
  terms:=nullif(btrim(p_data->>'deliveryTerms'),'');
  expires:=nullif(p_data->>'promotionEndsAt','')::timestamptz;
  if (reference_price is not null and (reference_price<=(p_data->>'basePrice')::bigint or reference_price>9007199254740991))
    or (label is not null and (length(label)>80 or reference_price is null))
    or (expires is not null and reference_price is null) or length(terms)>1000 then
    raise exception using errcode='22023',message='Invalid promotion or delivery terms';
  end if;
  -- Clear the old comparison atomically before changing base_price, avoiding
  -- intermediate CHECK failures when a real sale price/reference is changed.
  if not p_create then
    update public.furniture_models set compare_at_price=null,promotion_label=null,promotion_ends_at=null where product_id=p_data->>'id';
  end if;
  perform public.save_furniture_product_pre_phase5(p_data,p_create,p_expected_stock);
  update public.furniture_models set compare_at_price=reference_price,promotion_label=label,
    promotion_ends_at=expires,delivery_terms=terms where product_id=p_data->>'id';
end $$;
revoke all on function public.save_furniture_product(jsonb,boolean,integer),public.save_furniture_product_pre_phase5(jsonb,boolean,integer) from public,anon,authenticated;
grant execute on function public.save_furniture_product(jsonb,boolean,integer),public.save_furniture_product_pre_phase5(jsonb,boolean,integer) to service_role;

alter function public.save_merchant_product_v2(uuid,jsonb,boolean,boolean,integer) rename to save_merchant_product_pre_phase5;
create function public.save_merchant_product_v2(p_actor uuid,p_data jsonb,p_create boolean,p_model_requested boolean default false,p_expected_stock integer default null)
returns void language plpgsql security invoker set search_path='' as $$
declare store_id text;
begin
  perform 1 from public.profiles where id=p_actor and role='merchant' for share;
  if not found then raise exception using errcode='42501',message='Merchant required'; end if;
  select id into store_id from public.merchant_stores where owner_id=p_actor and active for share;
  if not found then raise exception using errcode='42501',message='Active store required'; end if;
  if not p_create then
    perform 1 from public.furniture_models where product_id=p_data->>'id' and archived_at is null and store_ids=jsonb_build_array(store_id) for update;
    if not found then raise exception using errcode='P0002',message='Active owned product required'; end if;
  end if;
  perform public.save_merchant_product_pre_phase5(p_actor,p_data,p_create,p_model_requested,p_expected_stock);
end $$;
revoke all on function public.save_merchant_product_v2(uuid,jsonb,boolean,boolean,integer),public.save_merchant_product_pre_phase5(uuid,jsonb,boolean,boolean,integer) from public,anon,authenticated;
grant execute on function public.save_merchant_product_v2(uuid,jsonb,boolean,boolean,integer),public.save_merchant_product_pre_phase5(uuid,jsonb,boolean,boolean,integer) to service_role;

create function public.read_merchant_products_v2(p_actor uuid,p_after uuid default null,p_include_archived boolean default false)
returns setof public.furniture_models language plpgsql security invoker set search_path='' as $$
declare store_id text;
begin
  perform 1 from public.profiles where id=p_actor and role='merchant' for share;
  if not found then raise exception using errcode='42501',message='Merchant required'; end if;
  select id into store_id from public.merchant_stores where owner_id=p_actor and active for share;
  if not found then return; end if;
  return query select m.* from public.furniture_models m where m.store_ids=jsonb_build_array(store_id)
    and (p_include_archived or m.archived_at is null) and (p_after is null or m.id>p_after) order by m.id limit 500;
end $$;

create function public.set_merchant_product_archived(p_actor uuid,p_product text,p_archived boolean)
returns void language plpgsql security invoker set search_path='' as $$
declare store_id text;
begin
  perform 1 from public.profiles where id=p_actor and role='merchant' for share;
  if not found then raise exception using errcode='42501',message='Merchant required'; end if;
  select id into store_id from public.merchant_stores where owner_id=p_actor and active for share;
  if not found then raise exception using errcode='42501',message='Active store required'; end if;
  if p_archived is null then raise exception using errcode='22023',message='Archive state required'; end if;
  -- Same row lock used by checkout: archive and reserve cannot race past each other.
  update public.furniture_models set archived_at=case when p_archived then coalesce(archived_at,now()) else null end,
    archived_by=case when p_archived then p_actor else null end,
    processing_job_id=case when p_archived then null else processing_job_id end,
    processing_status=case when p_archived and processing_status in ('queued','processing') then 'error' else processing_status end,
    processing_error=case when p_archived and processing_status in ('queued','processing') then 'Archived by merchant' else processing_error end,
    updated_at=now()
    where product_id=p_product and store_ids=jsonb_build_array(store_id);
  if not found then raise exception using errcode='P0002',message='Owned product required'; end if;
end $$;
revoke all on function public.read_merchant_products_v2(uuid,uuid,boolean),public.set_merchant_product_archived(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.read_merchant_products_v2(uuid,uuid,boolean),public.set_merchant_product_archived(uuid,text,boolean) to service_role;

-- The checkout snapshot is taken after the same sorted product locks that reserve
-- stock. A concurrent edit cannot change dimensions/seller terms between quote
-- and insert. Order financial immutability is enforced by the order migration.
create or replace function public.reserve_order_stock()
returns trigger language plpgsql security invoker set search_path='' as $$
declare selection record; furniture public.furniture_models; line jsonb; current_price bigint;
begin
  for selection in select x->>'productId' as id,sum((x->>'qty')::integer) as qty
    from jsonb_array_elements(new.items) x group by x->>'productId' order by x->>'productId'
  loop
    select * into furniture from public.furniture_models where product_id=selection.id for update;
    if not found or furniture.archived_at is not null or selection.qty<1 or coalesce(furniture.in_stock,0)<selection.qty then
      raise exception using errcode='P0004',message='Insufficient stock';
    end if;
    for line in select x from jsonb_array_elements(new.items) x where x->>'productId'=selection.id loop
      select furniture.base_price+coalesce((c->>'priceDelta')::bigint,0)+(m->>'priceDelta')::bigint into current_price
        from jsonb_array_elements(furniture.colors) c,jsonb_array_elements(furniture.materials) m
        where c->>'id'=line->>'color' and m->>'id'=line->>'material';
      if not found or current_price is distinct from (line->>'unitPrice')::bigint then
        raise exception using errcode='P0005',message='Catalog price changed';
      end if;
      if (line->>'qty')::integer not between 1 and 99 then raise exception using errcode='22023',message='Invalid quantity'; end if;
    end loop;
    select jsonb_agg(case when x.value->>'productId'=selection.id then x.value||jsonb_build_object(
      'name',furniture.name,'image',furniture.image_url,
      'colorName',(select c->>'name' from jsonb_array_elements(furniture.colors) c where c->>'id'=x.value->>'color'),
      'materialName',(select m->>'name' from jsonb_array_elements(furniture.materials) m where m->>'id'=x.value->>'material'),
      'productCategory',furniture.category,'storeIds',furniture.store_ids,
      'dimensions',jsonb_build_object('w',furniture.dimensions_w,'d',furniture.dimensions_d,'h',furniture.dimensions_h),
      'deliveryTerms',furniture.delivery_terms,'compareAtPrice',furniture.compare_at_price,
      'promotionLabel',furniture.promotion_label,'promotionEndsAt',furniture.promotion_ends_at
    ) else x.value end order by x.ordinality) into new.items from jsonb_array_elements(new.items) with ordinality x;
    update public.furniture_models set in_stock=in_stock-selection.qty,updated_at=now() where id=furniture.id;
  end loop;
  new.stock_reserved:=true;
  return new;
end $$;
revoke all on function public.reserve_order_stock() from public,anon,authenticated;
grant execute on function public.reserve_order_stock() to service_role;
notify pgrst,'reload schema';
commit;
