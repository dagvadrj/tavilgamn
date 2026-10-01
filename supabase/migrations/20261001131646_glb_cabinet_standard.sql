begin;

alter table public.furniture_models
  add column archived_at timestamptz,
  add column archived_by uuid references public.profiles(id),
  add column cabinet_module_id uuid references public.kitchen_modules(id),
  add column glb_validation jsonb;
create index furniture_models_cabinet_module_idx on public.furniture_models(cabinet_module_id);
create index furniture_models_archived_by_idx on public.furniture_models(archived_by);
update public.furniture_models m set cabinet_module_id=v.module_id
  from public.kitchen_module_variants v where v.furniture_model_id=m.id;

create table public.model_assets (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.furniture_models(id) on delete restrict,
  version_id uuid not null default gen_random_uuid(),
  role text not null check(role in ('source','delivery','preview','standard','thumbnail')),
  storage_path text not null unique check(length(storage_path) between 1 and 2048),
  original_name text,
  byte_size bigint check(byte_size between 12 and 209715200),
  sha256 text check(sha256 ~ '^[a-f0-9]{64}$'),
  state text not null default 'pending' check(state in ('pending','available','retired','deleted')),
  validation jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index model_assets_model_version_idx on public.model_assets(model_id,version_id);
create index model_assets_creator_idx on public.model_assets(created_by);
create index model_assets_pending_idx on public.model_assets(created_at) where state='pending';
alter table public.model_assets enable row level security;
revoke all on public.model_assets from public,anon,authenticated;
grant select,insert,update,delete on public.model_assets to service_role;
comment on table public.model_assets is 'Private durable object ledger. Register before PUT. Retired objects remain tracked, never automatically purge model history.';

create function public.sync_model_assets() returns trigger language plpgsql security invoker set search_path='' as $$
declare asset_path text; asset_role text; version uuid; old_path text;
begin
  version:=coalesce(new.processing_job_id,gen_random_uuid());
  for asset_role,asset_path in select * from (values
    ('source',new.source_glb_path),('delivery',new.glb_path),('preview',new.preview_glb_path),
    ('standard',new.standard_glb_path),('thumbnail',new.thumbnail_path)) as paths(role,path)
  loop
    if tg_op='UPDATE' then
      old_path:=case asset_role when 'source' then old.source_glb_path when 'delivery' then old.glb_path
        when 'preview' then old.preview_glb_path when 'standard' then old.standard_glb_path else old.thumbnail_path end;
      if old_path is distinct from asset_path and old_path is not null then
        -- Source NULL means the worker has confirmed removal. Other replaced assets are kept as history.
        update public.model_assets set state=case when asset_role='source' and asset_path is null then 'deleted' else 'retired' end,updated_at=now()
          where model_id=new.id and storage_path=old_path;
      end if;
    end if;
    if asset_path is not null then
      insert into public.model_assets(model_id,version_id,role,storage_path,state,validation)
        values(new.id,version,asset_role,asset_path,'available',case when asset_role='source' then new.glb_validation else null end)
        on conflict(storage_path) do update set state='available',updated_at=now();
      if exists(select 1 from public.model_assets where storage_path=asset_path and (model_id<>new.id or role<>asset_role)) then
        raise exception using errcode='22023',message='Asset belongs to a different model or role';
      end if;
    end if;
  end loop;
  return new;
end $$;
revoke all on function public.sync_model_assets() from public,anon,authenticated;
create trigger sync_model_assets after insert or update of source_glb_path,glb_path,preview_glb_path,standard_glb_path,thumbnail_path
  on public.furniture_models for each row execute function public.sync_model_assets();
-- Additive backfill: preserve all existing object URLs and model/variant IDs.
update public.furniture_models set glb_path=glb_path;

create function public.protect_archived_model() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='DELETE' then raise exception using errcode='22023',message='Archive models instead of deleting'; end if;
  if old.archived_at is not null and new.archived_at is not null and
    ((new.source_glb_path is not null and new.source_glb_path is distinct from old.source_glb_path) or new.glb_path is distinct from old.glb_path
     or new.preview_glb_path is distinct from old.preview_glb_path or new.standard_glb_path is distinct from old.standard_glb_path or new.processing_status in ('queued','processing')) then
    raise exception using errcode='22023',message='Archived model is read-only';
  end if;
  return new;
end $$;
revoke all on function public.protect_archived_model() from public,anon,authenticated;
create trigger protect_archived_model before update or delete on public.furniture_models
  for each row execute function public.protect_archived_model();

create function public.set_model_archived(p_actor uuid,p_model uuid,p_archived boolean)
returns void language plpgsql security invoker set search_path='' as $$
begin
  perform 1 from public.profiles where id=p_actor and role='admin' for share;
  if not found then raise exception using errcode='42501',message='Admin required'; end if;
  if p_archived is null then raise exception using errcode='22023',message='Archive state required'; end if;
  update public.furniture_models set archived_at=case when p_archived then coalesce(archived_at,now()) else null end,
    archived_by=case when p_archived then p_actor else null end,
    processing_job_id=case when p_archived then null else processing_job_id end,
    processing_status=case when p_archived and processing_status in ('queued','processing') then 'error' else processing_status end,
    processing_error=case when p_archived and processing_status in ('queued','processing') then 'Archived by admin' else processing_error end
    where id=p_model;
  if not found then raise exception using errcode='P0002',message='Model not found'; end if;
end $$;

create function public.queue_model_asset(p_actor uuid,p_model uuid,p_path text,p_sha256 text,p_validation jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare asset public.model_assets;
begin
  perform 1 from public.profiles where id=p_actor and role='admin' for share;
  if not found then raise exception using errcode='42501',message='Admin required'; end if;
  perform 1 from public.furniture_models where id=p_model and archived_at is null for update;
  if not found then raise exception using errcode='P0002',message='Active model not found'; end if;
  select * into asset from public.model_assets where model_id=p_model and storage_path=p_path and role='source' and created_by=p_actor for update;
  if not found or asset.state not in ('pending','available') then raise exception using errcode='22023',message='Upload intent not found'; end if;
  if asset.state='available' then return asset.version_id; end if; -- replay must not requeue completed source
  update public.model_assets set sha256=p_sha256,validation=p_validation,state='available',updated_at=now() where id=asset.id;
  update public.furniture_models set source_glb_path=p_path,processing_job_id=asset.version_id,
    processing_status='queued',processing_error=null,processing_requested_at=now(),processing_updated_at=now(),glb_validation=p_validation
    where id=p_model;
  return asset.version_id;
end $$;
revoke all on function public.set_model_archived(uuid,uuid,boolean),public.queue_model_asset(uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.set_model_archived(uuid,uuid,boolean),public.queue_model_asset(uuid,uuid,text,text,jsonb) to service_role;

create function public.enforce_cabinet_variant_code() returns trigger language plpgsql security invoker set search_path='' as $$
declare module public.kitchen_modules; model public.furniture_models; suffix text;
begin
  select * into model from public.furniture_models where id=new.furniture_model_id for share;
  select * into module from public.kitchen_modules where id=new.module_id for share;
  if model.archived_at is not null or model.processing_status<>'ready' or model.glb_path is null then
    raise exception using errcode='22023',message='Ready kitchen GLB required'; end if;
  if model.cabinet_module_id is not null and model.cabinet_module_id<>new.module_id then
    raise exception using errcode='22023',message='Model belongs to a different module'; end if;
  suffix:=case new.opening
    when 'doors' then new.door_count||case when new.door_count=1 then '-DOOR' else '-DOORS' end
    when 'drawers' then case when new.door_count>0 then new.door_count||case when new.door_count=1 then '-DOOR-' else '-DOORS-' end else '' end
      ||new.drawer_count||case when new.drawer_count=1 then '-DRAWER' else '-DRAWERS' end
    else upper(new.opening) end;
  if new.variant_code<>module.code||'-'||suffix then raise exception using errcode='22023',message='Canonical variant code required'; end if;
  if new.opening='doors' and new.door_count not between 1 and 4 then raise exception using errcode='22023',message='Invalid door count'; end if;
  if abs(model.dimensions_w*1000-module.width_mm)>5 or abs(model.dimensions_h*1000-module.height_mm)>5 or abs(model.dimensions_d*1000-module.depth_mm)>5 then
    raise exception using errcode='22023',message='Model dimensions do not match module'; end if;
  update public.furniture_models set cabinet_module_id=new.module_id where id=model.id and cabinet_module_id is null;
  return new;
end $$;
revoke all on function public.enforce_cabinet_variant_code() from public,anon,authenticated;
create trigger enforce_cabinet_variant_code before insert or update on public.kitchen_module_variants
  for each row execute function public.enforce_cabinet_variant_code();

-- Actual 740mm cabinets are not stretched into the standard 840mm module.
insert into public.kitchen_modules(code,name,cabinet_type,width_mm,height_mm,depth_mm)
values ('BASE-800-H740-D598','800мм 740 өндөртэй их бие (хөлгүй)','base',800,740,598)
on conflict(code) do nothing;

drop policy if exists "Public can read furniture models" on public.furniture_models;
create policy "Public can read furniture models" on public.furniture_models for select to anon,authenticated using(archived_at is null);
drop policy if exists kitchen_module_variants_public on public.kitchen_module_variants;
create policy kitchen_module_variants_public on public.kitchen_module_variants for select to anon,authenticated
  using(active and exists(select 1 from public.furniture_models m where m.id=furniture_model_id and m.archived_at is null));

create or replace function public.read_merchant_products(p_actor uuid,p_after uuid default null) returns setof public.furniture_models
language plpgsql security invoker set search_path='' as $$
declare store_id text;
begin
  perform 1 from public.profiles where id=p_actor and role='merchant' for share;
  if not found then raise exception using errcode='42501',message='Merchant required'; end if;
  select id into store_id from public.merchant_stores where owner_id=p_actor and active for share;
  if not found then return; end if;
  return query select m.* from public.furniture_models m where m.archived_at is null and m.store_ids=jsonb_build_array(store_id)
    and (p_after is null or m.id>p_after) order by m.id limit 500;
end $$;

-- A cached cart must not purchase an archived product. Keep price/stock locking.
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
    update public.furniture_models set in_stock=in_stock-selection.qty,updated_at=now() where id=furniture.id;
  end loop;
  new.stock_reserved:=true;
  return new;
end $$;
revoke all on function public.reserve_order_stock() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
