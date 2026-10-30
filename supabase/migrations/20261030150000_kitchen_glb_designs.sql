begin;

-- A ready-made kitchen may come from one uploaded full-kitchen GLB instead of a
-- planner project. Such designs have no source_garniture_id; each version keeps
-- its model in the design snapshot:
--   {source:'glb', layout, room:{width,depth}, model:{path,uploadId,bytes,widthMm,depthMm,heightMm,...}}
-- Replacing the GLB of a published design therefore always means a new version.

create function kitchen_internal.valid_kitchen_glb_model(p_actor uuid,p_model jsonb)
returns boolean language sql immutable set search_path='' as $$
  select jsonb_typeof(p_model)='object' and octet_length(p_model::text)<=20000
    and coalesce(p_model->>'path','') ~ ('^r2://[a-z0-9-]+/kitchen-designs/'||p_actor::text||'/[0-9a-f-]{36}\.glb$')
    and coalesce(p_model->>'widthMm','') ~ '^[0-9]{3,5}$' and (p_model->>'widthMm')::integer between 300 and 20000
    and coalesce(p_model->>'depthMm','') ~ '^[0-9]{3,5}$' and (p_model->>'depthMm')::integer between 300 and 20000
    and coalesce(p_model->>'heightMm','') ~ '^[0-9]{3,5}$' and (p_model->>'heightMm')::integer between 300 and 10000
$$;

create function kitchen_internal.kitchen_glb_snapshot(p_model jsonb,p_layout text)
returns jsonb language sql immutable set search_path='' as $$
  select jsonb_build_object('source','glb','layout',p_layout,'model',p_model,'room',jsonb_build_object(
    'width',greatest((p_model->>'widthMm')::integer,1000),'depth',greatest((p_model->>'depthMm')::integer,1000)))
$$;

create function public.create_kitchen_marketplace_glb_design(p_actor uuid,p_slug text,p_payload jsonb,p_model jsonb)
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
  if layout_name not in ('straight','l-left','l-right','double-side') then
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
    kitchen_internal.kitchen_glb_snapshot(p_model,layout_name),coalesce(p_payload->>'style','modern'),layout_name,
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

-- Swap the GLB of an editable (draft / changes requested) version. Pictures of
-- the old geometry are retired; the browser uploads a fresh thumbnail next.
create function public.replace_kitchen_marketplace_glb(p_actor uuid,p_design uuid,p_version uuid,p_model jsonb,p_payload jsonb)
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
  if layout_name not in ('straight','l-left','l-right','double-side') or modules not between 1 and 80 then
    raise exception using errcode='22023',message='Invalid kitchen layout'; end if;
  update public.kitchen_design_versions set design=kitchen_internal.kitchen_glb_snapshot(p_model,layout_name),
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

-- new_version normally re-reads the planner project. A GLB design has none, so
-- its next version starts as a copy of the latest version's model and listing.
create or replace function public.save_kitchen_marketplace_version(p_actor uuid,p_design uuid,p_version uuid,p_mode text,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb; project_data jsonb; cabinets jsonb; thumbnail text;
  target_design public.kitchen_designs; current_version public.kitchen_design_versions;
  target_version uuid; next_version integer;
begin
  select * into target_design from public.kitchen_designs where id=p_design;
  if found and target_design.source_garniture_id is null and p_mode='sync_project' then
    raise exception using errcode='P0002',message='Source kitchen project not found'; end if;
  if found and target_design.source_garniture_id is null and p_mode='new_version' then
    perform set_config('app.kitchen_actor',p_actor::text,true);
    perform 1 from public.profiles where id=p_actor and role='merchant' for share;
    if not found then raise exception using errcode='42501',message='Merchant required'; end if;
    select d.* into target_design from public.kitchen_designs d join public.merchant_stores s on s.id=d.store_id
      where d.id=p_design and d.created_by=p_actor and s.owner_id=p_actor and s.active
        and s.store_type in ('factory','handmade') and d.publication_status not in ('archived','suspended')
      for update of d;
    if not found then raise exception using errcode='42501',message='Kitchen design owner required'; end if;
    select * into current_version from public.kitchen_design_versions
      where design_id=p_design order by version_no desc limit 1 for update;
    if not found or current_version.id<>p_version then
      raise exception using errcode='P0012',message='Stale kitchen version'; end if;
    if not (current_version.review_status='rejected' or
      (target_design.publication_status='published' and target_design.published_version_id=current_version.id)) then
      raise exception using errcode='P0012',message='New kitchen version is not allowed'; end if;
    next_version:=current_version.version_no+1;
    insert into public.kitchen_design_versions(design_id,version_no,title,short_description,description,design,style,layout,tags,
      pricing_mode,price_from,price_to,materials,lead_time_days,installation_included,warranty_months,service_areas,inclusions,exclusions,
      cabinet_count,base_count,wall_count,tall_count,min_room_width_mm,min_room_depth_mm,max_height_mm,component_product_ids,created_by)
    values(p_design,next_version,p_payload->>'title',coalesce(p_payload->>'shortDescription',''),coalesce(p_payload->>'description',''),
      current_version.design,coalesce(p_payload->>'style','modern'),current_version.layout,coalesce(p_payload->'tags','[]'::jsonb),
      coalesce(p_payload->>'pricingMode','quote'),nullif(p_payload->>'priceFrom','')::bigint,nullif(p_payload->>'priceTo','')::bigint,
      coalesce(p_payload->'materials','[]'::jsonb),nullif(p_payload->>'leadTimeDays','')::integer,
      coalesce((p_payload->>'installationIncluded')::boolean,false),nullif(p_payload->>'warrantyMonths','')::integer,
      coalesce(p_payload->'serviceAreas','[]'::jsonb),coalesce(p_payload->'inclusions','[]'::jsonb),coalesce(p_payload->'exclusions','[]'::jsonb),
      current_version.cabinet_count,current_version.base_count,current_version.wall_count,current_version.tall_count,
      current_version.min_room_width_mm,current_version.min_room_depth_mm,current_version.max_height_mm,'[]'::jsonb,p_actor)
    returning id into target_version;
    -- The model is unchanged, so its merchant pictures carry over to the new version.
    insert into public.kitchen_design_media(version_id,kind,source,url,alt_text,sort_order,is_primary,width,height,metadata)
      select target_version,kind,source,url,alt_text,sort_order,is_primary,width,height,metadata
      from public.kitchen_design_media where version_id=current_version.id and status='ready' and source='merchant';
    update public.kitchen_designs set updated_at=clock_timestamp() where id=p_design;
    return jsonb_build_object('designId',p_design,'versionId',target_version,'versionNo',next_version,'created',true);
  end if;

  result:=kitchen_internal.save_kitchen_marketplace_version(p_actor,p_design,p_version,
    case when p_mode='sync_project' then 'edit' else p_mode end,p_payload);
  if p_mode='sync_project' then
    if exists(select 1 from public.kitchen_render_jobs where version_id=p_version and status in ('queued','processing')) then
      raise exception using errcode='P0016',message='Cancel active render before syncing'; end if;
    select g.design,g.thumbnail_url into project_data,thumbnail from public.kitchen_garnitures g
      join public.kitchen_designs d on d.source_garniture_id=g.id and d.created_by=g.user_id
      where d.id=p_design and g.user_id=p_actor for share of g;
    if not found then raise exception using errcode='P0002',message='Source kitchen project not found'; end if;
    cabinets:=project_data->'cabinets';
    if jsonb_typeof(cabinets) is distinct from 'array' or jsonb_array_length(cabinets) not between 1 and 80 then
      raise exception using errcode='22023',message='Invalid source kitchen'; end if;
    update public.kitchen_design_versions set design=project_data,layout=project_data->>'layout',
      cabinet_count=jsonb_array_length(cabinets),
      base_count=(select count(*) from jsonb_array_elements(cabinets) c where c->>'type'='base'),
      wall_count=(select count(*) from jsonb_array_elements(cabinets) c where c->>'type'='wall'),
      tall_count=(select count(*) from jsonb_array_elements(cabinets) c where c->>'type'='tall'),
      min_room_width_mm=(project_data#>>'{room,width}')::integer,min_room_depth_mm=(project_data#>>'{room,depth}')::integer,
      max_height_mm=(select max((c->>'height')::integer+(c#>>'{position,y}')::integer) from jsonb_array_elements(cabinets) c),
      component_product_ids=(select coalesce(jsonb_agg(distinct coalesce(c->>'variantId',c->>'productId'))
        filter(where coalesce(c->>'variantId',c->>'productId') is not null),'[]') from jsonb_array_elements(cabinets) c)
      where id=p_version;
    -- Derived pictures of the old geometry must never represent the new snapshot.
    update public.kitchen_design_media set status='rejected',is_primary=false
      where version_id=p_version and (source in ('system','ai') or kind='thumbnail');
    if thumbnail is not null then
      insert into public.kitchen_design_media(version_id,kind,source,url,is_primary)
        values(p_version,'thumbnail','system',thumbnail,true);
    end if;
  end if;
  return result;
end;
$$;

revoke all on function kitchen_internal.valid_kitchen_glb_model(uuid,jsonb) from public,anon,authenticated;
revoke all on function kitchen_internal.kitchen_glb_snapshot(jsonb,text) from public,anon,authenticated;
grant execute on function kitchen_internal.valid_kitchen_glb_model(uuid,jsonb) to service_role;
grant execute on function kitchen_internal.kitchen_glb_snapshot(jsonb,text) to service_role;
revoke all on function public.create_kitchen_marketplace_glb_design(uuid,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.create_kitchen_marketplace_glb_design(uuid,text,jsonb,jsonb) to service_role;
revoke all on function public.replace_kitchen_marketplace_glb(uuid,uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.replace_kitchen_marketplace_glb(uuid,uuid,uuid,jsonb,jsonb) to service_role;
revoke all on function public.save_kitchen_marketplace_version(uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.save_kitchen_marketplace_version(uuid,uuid,uuid,text,jsonb) to service_role;

notify pgrst,'reload schema';
commit;
