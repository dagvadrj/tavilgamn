begin;

-- Kitchens running along three walls (or two walls and a peninsula) are "u".
-- The planner already supports it; listings and GLB uploads now accept it too.
alter table public.kitchen_design_versions drop constraint if exists kitchen_design_versions_layout_check;
alter table public.kitchen_design_versions add constraint kitchen_design_versions_layout_check
  check (layout in ('straight','l-left','l-right','u','double-side'));

create or replace function public.create_kitchen_marketplace_glb_design(p_actor uuid,p_slug text,p_payload jsonb,p_model jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare target_store public.merchant_stores; target_design uuid; target_version uuid;
  layout_name text:=coalesce(p_payload->>'layout','straight'); modules integer;
begin
  perform set_config('app.kitchen_actor',p_actor::text,true);
  perform 1 from public.profiles where id=p_actor and role='merchant' for share;
  if not found then raise exception using errcode='42501',message='Merchant required'; end if;
  select * into target_store from public.merchant_stores where owner_id=p_actor and active for share;
  if not found or target_store.store_type not in ('factory','handmade') then
    raise exception using errcode='42501',message='Kitchen publisher required';
  end if;
  if not kitchen_internal.valid_kitchen_glb_model(p_actor,p_model) then
    raise exception using errcode='22023',message='Invalid kitchen GLB model';
  end if;
  if layout_name not in ('straight','l-left','l-right','u','double-side') then
    raise exception using errcode='22023',message='Invalid kitchen layout';
  end if;
  modules:=nullif(p_payload->>'cabinetCount','')::integer;
  if modules is null or modules not between 1 and 80 then
    raise exception using errcode='22023',message='Invalid cabinet count';
  end if;
  insert into public.kitchen_designs(store_id,created_by,source_garniture_id,slug)
    values(target_store.id,p_actor,null,p_slug) returning id into target_design;
  insert into public.kitchen_design_versions(design_id,version_no,title,short_description,description,design,style,layout,tags,
    pricing_mode,price_from,price_to,materials,lead_time_days,installation_included,warranty_months,service_areas,inclusions,exclusions,
    cabinet_count,min_room_width_mm,min_room_depth_mm,max_height_mm,component_product_ids,created_by)
  values(target_design,1,p_payload->>'title',coalesce(p_payload->>'shortDescription',''),coalesce(p_payload->>'description',''),
    kitchen_internal.kitchen_glb_snapshot(p_model,layout_name,p_payload->'planner'),coalesce(p_payload->>'style','modern'),layout_name,
    coalesce(p_payload->'tags','[]'::jsonb),coalesce(p_payload->>'pricingMode','quote'),
    nullif(p_payload->>'priceFrom','')::bigint,nullif(p_payload->>'priceTo','')::bigint,coalesce(p_payload->'materials','[]'::jsonb),
    nullif(p_payload->>'leadTimeDays','')::integer,coalesce((p_payload->>'installationIncluded')::boolean,false),
    nullif(p_payload->>'warrantyMonths','')::integer,coalesce(p_payload->'serviceAreas','[]'::jsonb),
    coalesce(p_payload->'inclusions','[]'::jsonb),coalesce(p_payload->'exclusions','[]'::jsonb),
    modules,greatest((p_model->>'widthMm')::integer,1000),greatest((p_model->>'depthMm')::integer,1000),
    (p_model->>'heightMm')::integer,'[]'::jsonb,p_actor)
  returning id into target_version;
  return jsonb_build_object('designId',target_design,'versionId',target_version);
end;
$$;

create or replace function public.replace_kitchen_marketplace_glb(p_actor uuid,p_design uuid,p_version uuid,p_model jsonb,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare target public.kitchen_design_versions; layout_name text; modules integer;
begin
  perform set_config('app.kitchen_actor',p_actor::text,true);
  perform 1 from public.kitchen_designs d join public.merchant_stores s on s.id=d.store_id
    where d.id=p_design and d.created_by=p_actor and s.owner_id=p_actor and s.active
      and s.store_type in ('factory','handmade') and d.source_garniture_id is null
      and d.publication_status not in ('archived','suspended')
    for update of d;
  if not found then raise exception using errcode='42501',message='Kitchen design owner required'; end if;
  select * into target from public.kitchen_design_versions where id=p_version and design_id=p_design for update;
  if not found or target.design->>'source' is distinct from 'glb' then
    raise exception using errcode='P0002',message='GLB kitchen version not found'; end if;
  if target.review_status not in ('draft','changes_requested') then
    raise exception using errcode='P0012',message='Kitchen version is not editable'; end if;
  if exists(select 1 from public.kitchen_render_jobs where version_id=p_version and status in ('queued','processing')) then
    raise exception using errcode='P0016',message='Cancel active render before replacing the model'; end if;
  if not kitchen_internal.valid_kitchen_glb_model(p_actor,p_model) then
    raise exception using errcode='22023',message='Invalid kitchen GLB model'; end if;
  layout_name:=coalesce(nullif(p_payload->>'layout',''),target.layout);
  modules:=coalesce(nullif(p_payload->>'cabinetCount','')::integer,target.cabinet_count);
  if layout_name not in ('straight','l-left','l-right','u','double-side') or modules not between 1 and 80 then
    raise exception using errcode='22023',message='Invalid kitchen layout'; end if;
  update public.kitchen_design_versions set design=kitchen_internal.kitchen_glb_snapshot(p_model,layout_name,p_payload->'planner'),
    layout=layout_name,cabinet_count=modules,
    min_room_width_mm=greatest((p_model->>'widthMm')::integer,1000),
    min_room_depth_mm=greatest((p_model->>'depthMm')::integer,1000),
    max_height_mm=(p_model->>'heightMm')::integer
    where id=p_version;
  update public.kitchen_design_media set status='rejected',is_primary=false
    where version_id=p_version and (source in ('system','ai') or kind='thumbnail');
  update public.kitchen_designs set updated_at=clock_timestamp() where id=p_design;
  return jsonb_build_object('designId',p_design,'versionId',p_version);
end;
$$;

notify pgrst,'reload schema';
commit;
