-- Separate kitchen products physically, retaining immutable model IDs and all assets.
-- Registry is an ownership-independent FK target for the shared file/version ledger.
lock table public.furniture_models, public.model_assets, public.kitchen_module_variants in share row exclusive mode;
create table public.kitchen_models (like public.furniture_models including all);
alter table public.kitchen_models add constraint kitchen_models_domain check(category='kitchen-cabinet');
alter table public.kitchen_models add constraint kitchen_models_module_fk foreign key(cabinet_module_id) references public.kitchen_modules(id);
alter table public.kitchen_models add constraint kitchen_models_archived_by_fk foreign key(archived_by) references public.profiles(id);
alter table public.kitchen_models enable row level security;
revoke all on public.kitchen_models from public,anon,authenticated;
grant select,insert,update,delete on public.kitchen_models to service_role;

create table public.model_registry (
  id uuid primary key,
  domain text not null check(domain in ('furniture','kitchen'))
);
alter table public.model_registry enable row level security;
revoke all on public.model_registry from public,anon,authenticated;
grant select,insert,update on public.model_registry to service_role;
insert into public.model_registry(id,domain)
  select id,case when category='kitchen-cabinet' then 'kitchen' else 'furniture' end from public.furniture_models;
insert into public.kitchen_models select * from public.furniture_models where category='kitchen-cabinet';

alter table public.model_assets drop constraint model_assets_model_id_fkey;
alter table public.model_assets add constraint model_assets_model_id_fkey foreign key(model_id) references public.model_registry(id) on delete restrict;
alter table public.product_media_refs drop constraint product_media_refs_model_id_fkey;
alter table public.product_media_refs add constraint product_media_refs_model_id_fkey foreign key(model_id) references public.model_registry(id) on delete restrict;
alter table public.kitchen_module_variants drop constraint kitchen_module_variants_furniture_model_id_fkey;
alter table public.kitchen_module_variants add constraint kitchen_module_variants_kitchen_model_id_fkey foreign key(furniture_model_id) references public.kitchen_models(id) on delete restrict;

-- Atomic relocation only: all columns must be identical in the destination.
-- Order/reservation protections stay enabled and abort the transaction if violated.
alter table public.furniture_models disable trigger protect_archived_model;
delete from public.furniture_models f using public.kitchen_models k
  where f.id=k.id and f.category='kitchen-cabinet' and to_jsonb(f)=to_jsonb(k);
alter table public.furniture_models enable trigger protect_archived_model;
do $$ begin
  if exists(select 1 from public.furniture_models where category='kitchen-cabinet') then
    raise exception 'Kitchen relocation was not complete; rolling back';
  end if;
end $$;
alter table public.furniture_models add constraint furniture_models_domain check(category<>'kitchen-cabinet');
alter table public.furniture_models add constraint furniture_models_registry_fk foreign key(id) references public.model_registry(id);
alter table public.kitchen_models add constraint kitchen_models_registry_fk foreign key(id) references public.model_registry(id);

create function public.register_model_domain() returns trigger language plpgsql security invoker set search_path='' as $$
declare expected text:=case when tg_table_name='kitchen_models' then 'kitchen' else 'furniture' end;
begin
  insert into public.model_registry(id,domain) values(new.id,expected) on conflict(id) do nothing;
  if not exists(select 1 from public.model_registry where id=new.id and domain=expected for share) then
    raise exception using errcode='23505',message='Model ID belongs to another domain';
  end if;
  return new;
end $$;
revoke all on function public.register_model_domain() from public,anon,authenticated;
grant execute on function public.register_model_domain() to service_role;
create trigger register_model_domain before insert on public.furniture_models for each row execute function public.register_model_domain();
create trigger register_model_domain before insert on public.kitchen_models for each row execute function public.register_model_domain();
create trigger protect_archived_model before update or delete on public.kitchen_models for each row execute function public.protect_archived_model();
create trigger sync_model_assets after insert or update of source_glb_path,glb_path,preview_glb_path,standard_glb_path,thumbnail_path on public.kitchen_models for each row execute function public.sync_model_assets();
create trigger sync_product_media_refs after insert or update of image_url,images,store_ids on public.kitchen_models for each row execute function public.sync_product_media_refs();

-- Read-only bridge for shared delivery/status endpoints. Never a storefront source.
create view public.model_records with(security_invoker=true) as
  select * from public.furniture_models union all select * from public.kitchen_models;
revoke all on public.model_records from public,anon,authenticated;
grant select on public.model_records to service_role;

CREATE OR REPLACE FUNCTION public.save_kitchen_module_variant(p_actor uuid, p_model uuid, p_module uuid, p_payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare target_module public.kitchen_modules; target_model public.kitchen_models;
  opening_value text; variant_code_value text; door_value integer; drawer_value integer; default_value boolean;
begin
  perform 1 from public.profiles where id=p_actor and role='admin' for share;
  if not found then raise exception using errcode='42501',message='Admin required'; end if;
  select * into target_module from public.kitchen_modules where id=p_module and active for share;
  if not found then raise exception using errcode='P0002',message='Kitchen module not found'; end if;
  select * into target_model from public.kitchen_models where id=p_model for share;
  if not found then raise exception using errcode='P0002',message='Furniture model not found'; end if;
  if target_model.category<>'kitchen-cabinet' or target_model.glb_path is null then
    raise exception using errcode='22023',message='Ready kitchen GLB required';
  end if;
  if abs(round(target_model.dimensions_w*1000)-target_module.width_mm)>10
    or abs(round(target_model.dimensions_h*1000)-target_module.height_mm)>10
    or abs(round(target_model.dimensions_d*1000)-target_module.depth_mm)>10 then
    raise exception using errcode='22023',message='Model dimensions do not match module';
  end if;
  opening_value:=p_payload->>'opening';
  variant_code_value:=upper(p_payload->>'variantCode');
  door_value:=coalesce((p_payload->>'doorCount')::integer,0);
  drawer_value:=coalesce((p_payload->>'drawerCount')::integer,0);
  default_value:=coalesce((p_payload->>'isDefault')::boolean,false);
  if variant_code_value is null or variant_code_value !~ '^[A-Z0-9][A-Z0-9_-]{1,79}$'
    or opening_value not in ('doors','drawers','open','sink','hob','oven','hood','refrigerator') then
    raise exception using errcode='22023',message='Invalid kitchen variant';
  end if;
  if target_module.cabinet_type='wall' and (opening_value='drawers' or drawer_value<>0)
    or opening_value='drawers' and drawer_value not between 1 and 4
    or opening_value<>'drawers' and drawer_value<>0
    or target_module.cabinet_type='corner' and opening_value not in ('doors','open')
    or opening_value='oven' and (target_module.width_mm<>600 or target_module.cabinet_type not in ('base','tall')) then
    raise exception using errcode='22023',message='Variant does not fit module';
  end if;
  if default_value then update public.kitchen_module_variants set is_default=false where module_id=p_module and furniture_model_id<>p_model; end if;
  insert into public.kitchen_module_variants(furniture_model_id,module_id,variant_code,opening,door_count,drawer_count,configuration,is_default,sort_order,active)
  values(p_model,p_module,variant_code_value,opening_value,door_value,drawer_value,
    coalesce(p_payload->'configuration','{}'::jsonb),default_value,coalesce((p_payload->>'sortOrder')::integer,0),true)
  on conflict(furniture_model_id) do update set module_id=excluded.module_id,variant_code=excluded.variant_code,
    opening=excluded.opening,door_count=excluded.door_count,drawer_count=excluded.drawer_count,
    configuration=excluded.configuration,is_default=excluded.is_default,sort_order=excluded.sort_order,active=true;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_cabinet_variant_code()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare module public.kitchen_modules; model public.kitchen_models; suffix text; design_code text;
begin
  select * into model from public.kitchen_models where id=new.furniture_model_id for share;
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
  design_code:=coalesce(new.configuration->>'designCode','');
  if design_code<>'' then
    if design_code !~ '^[A-Z0-9]{1,16}(-[A-Z0-9]{1,16}){0,3}$' then
      raise exception using errcode='22023',message='Canonical design code required'; end if;
    suffix:=suffix||'-'||design_code;
  end if;
  if new.variant_code<>module.code||'-'||suffix or length(new.variant_code)>80 then
    raise exception using errcode='22023',message='Canonical variant code required'; end if;
  if new.opening='doors' and new.door_count not between 1 and 4 then raise exception using errcode='22023',message='Invalid door count'; end if;
  if abs(model.dimensions_w*1000-module.width_mm)>5 or abs(model.dimensions_h*1000-module.height_mm)>5 or abs(model.dimensions_d*1000-module.depth_mm)>5 then
    raise exception using errcode='22023',message='Model dimensions do not match module'; end if;
  update public.kitchen_models set cabinet_module_id=new.module_id where id=model.id and cabinet_module_id is null;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.queue_kitchen_model_asset(p_actor uuid, p_model uuid, p_path text, p_sha256 text, p_validation jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare asset public.model_assets;
begin
  perform 1 from public.profiles where id=p_actor and role='admin' for share;
  if not found then raise exception using errcode='42501',message='Admin required'; end if;
  perform 1 from public.kitchen_models where id=p_model and archived_at is null for update;
  if not found then raise exception using errcode='P0002',message='Active model not found'; end if;
  select * into asset from public.model_assets where model_id=p_model and storage_path=p_path and role='source' and created_by=p_actor for update;
  if not found or asset.state not in ('pending','available') then raise exception using errcode='22023',message='Upload intent not found'; end if;
  if asset.state='available' then return asset.version_id; end if; -- replay must not requeue completed source
  update public.model_assets set sha256=p_sha256,validation=p_validation,state='available',updated_at=now() where id=asset.id;
  update public.kitchen_models set source_glb_path=p_path,processing_job_id=asset.version_id,
    processing_status='queued',processing_error=null,processing_requested_at=now(),processing_updated_at=now(),glb_validation=p_validation
    where id=p_model;
  return asset.version_id;
end $function$
;
revoke all on function public.queue_kitchen_model_asset(uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.queue_kitchen_model_asset(uuid,uuid,text,text,jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.set_kitchen_model_archived(p_actor uuid, p_model uuid, p_archived boolean)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  perform 1 from public.profiles where id=p_actor and role='admin' for share;
  if not found then raise exception using errcode='42501',message='Admin required'; end if;
  if p_archived is null then raise exception using errcode='22023',message='Archive state required'; end if;
  update public.kitchen_models set archived_at=case when p_archived then coalesce(archived_at,now()) else null end,
    archived_by=case when p_archived then p_actor else null end,
    processing_job_id=case when p_archived then null else processing_job_id end,
    processing_status=case when p_archived and processing_status in ('queued','processing') then 'error' else processing_status end,
    processing_error=case when p_archived and processing_status in ('queued','processing') then 'Archived by admin' else processing_error end
    where id=p_model;
  if not found then raise exception using errcode='P0002',message='Model not found'; end if;
end $function$
;
revoke all on function public.set_kitchen_model_archived(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.set_kitchen_model_archived(uuid,uuid,boolean) to service_role;

CREATE OR REPLACE FUNCTION public.request_kitchen_model_export(p_actor uuid, p_model uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  target public.kitchen_models;
  new_job uuid := gen_random_uuid();
begin
  perform 1
  from public.profiles
  where id = p_actor
    and role = 'admin';

  if not found then
    raise exception using
      errcode='42501',
      message='Admin required';
  end if;

  select *
  into target
  from public.kitchen_models
  where id = p_model
  for update;

  if not found then
    raise exception using
      errcode='P0002',
      message='Model not found';
  end if;

  if target.processing_status <> 'ready'
     or target.glb_path is null then
    raise exception using
      errcode='55000',
      message='Delivery model is not ready';
  end if;

  if target.export_status = 'ready'
     and target.standard_glb_path is not null then
    return jsonb_build_object(
      'status', 'ready',
      'jobId', target.export_job_id,
      'ready', true
    );
  end if;

  if target.export_status in ('queued','processing') then
    return jsonb_build_object(
      'status', target.export_status,
      'jobId', target.export_job_id,
      'ready', false
    );
  end if;

  update public.kitchen_models
  set
    export_status = 'queued',
    export_error = null,
    export_requested_at = now(),
    export_updated_at = now(),
    export_job_id = new_job
  where id = p_model;

  return jsonb_build_object(
    'status', 'queued',
    'jobId', new_job,
    'ready', false
  );
end
$function$
;
revoke all on function public.request_kitchen_model_export(uuid,uuid) from public,anon,authenticated;
grant execute on function public.request_kitchen_model_export(uuid,uuid) to service_role;

CREATE OR REPLACE FUNCTION public.claim_kitchen_model_job()
 RETURNS SETOF public.kitchen_models
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO ''
AS $function$
declare
  job public.kitchen_models%rowtype;
begin
  select *
  into job
  from public.kitchen_models
  where processing_status = 'queued'
  order by processing_requested_at asc nulls last
  for update skip locked
  limit 1;

  if not found then
    return;
  end if;

  update public.kitchen_models
  set
    processing_status = 'processing',
    processing_error = null,
    processing_updated_at = now()
  where id = job.id
    and processing_job_id = job.processing_job_id
    and processing_status = 'queued'
  returning *
  into job;

  if not found then
    return;
  end if;

  return next job;
end;
$function$
;
revoke all on function public.claim_kitchen_model_job() from public,anon,authenticated;
grant execute on function public.claim_kitchen_model_job() to service_role;

CREATE OR REPLACE FUNCTION public.claim_kitchen_model_export_job()
 RETURNS SETOF public.kitchen_models
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO ''
AS $function$
declare
  job public.kitchen_models%rowtype;
begin
  select *
  into job
  from public.kitchen_models
  where export_status = 'queued'
  order by export_requested_at asc nulls last
  for update skip locked
  limit 1;

  if not found then
    return;
  end if;

  update public.kitchen_models
  set
    export_status = 'processing',
    export_error = null,
    export_updated_at = now()
  where id = job.id
    and export_job_id = job.export_job_id
    and export_status = 'queued'
  returning *
  into job;

  if not found then
    return;
  end if;

  return next job;
end
$function$
;
revoke all on function public.claim_kitchen_model_export_job() from public,anon,authenticated;
grant execute on function public.claim_kitchen_model_export_job() to service_role;
notify pgrst,'reload schema';

