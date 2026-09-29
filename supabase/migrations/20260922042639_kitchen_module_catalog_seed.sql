begin;

insert into public.kitchen_modules(code,name,cabinet_type,width_mm,height_mm,depth_mm)
select 'BASE-'||width_mm, width_mm||'мм доод шүүгээ', 'base', width_mm, 820, 600
from unnest(array[300,400,450,500,600,700,800,900,1000]) width_mm
union all
select 'WALL-'||width_mm, width_mm||'мм дээд шүүгээ', 'wall', width_mm, 720, 350
from unnest(array[300,400,450,500,600,700,800,900]) width_mm
union all
select 'TALL-'||width_mm, width_mm||'мм өндөр шүүгээ', 'tall', width_mm, 2600, 600
from unnest(array[300,400,450,500,600,700,800,900]) width_mm
union all
select 'CORNER-BASE-1000','1000мм булангийн доод шүүгээ','corner',1000,820,600
on conflict(code) do update set name=excluded.name,cabinet_type=excluded.cabinet_type,
  width_mm=excluded.width_mm,height_mm=excluded.height_mm,depth_mm=excluded.depth_mm,active=true;

create function public.save_kitchen_module_variant(
  p_actor uuid,p_model uuid,p_module uuid,p_payload jsonb
) returns void language plpgsql security invoker set search_path='' as $$
declare target_module public.kitchen_modules; target_model public.furniture_models;
  opening_value text; variant_code_value text; door_value integer; drawer_value integer; default_value boolean;
begin
  perform 1 from public.profiles where id=p_actor and role='admin' for share;
  if not found then raise exception using errcode='42501',message='Admin required'; end if;
  select * into target_module from public.kitchen_modules where id=p_module and active for share;
  if not found then raise exception using errcode='P0002',message='Kitchen module not found'; end if;
  select * into target_model from public.furniture_models where id=p_model for share;
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
$$;

create function public.set_kitchen_module_variant_active(p_actor uuid,p_model uuid,p_active boolean)
returns void language plpgsql security invoker set search_path='' as $$
begin
  perform 1 from public.profiles where id=p_actor and role='admin' for share;
  if not found then raise exception using errcode='42501',message='Admin required'; end if;
  update public.kitchen_module_variants set active=p_active,is_default=case when p_active then is_default else false end
    where furniture_model_id=p_model;
  if not found then raise exception using errcode='P0002',message='Kitchen variant not found'; end if;
end;
$$;

create or replace function public.create_kitchen_marketplace_design(
  p_actor uuid,p_source_id uuid,p_slug text,p_payload jsonb
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare target_store public.merchant_stores; project_data jsonb; target_design uuid; target_version uuid;
  cabinets jsonb; product_ids jsonb;
begin
  perform 1 from public.profiles where id=p_actor and role='merchant' for share;
  if not found then raise exception using errcode='42501',message='Merchant required'; end if;
  select * into target_store from public.merchant_stores where owner_id=p_actor and active for share;
  if not found or target_store.store_type not in ('factory','handmade') then
    raise exception using errcode='42501',message='Kitchen publisher required';
  end if;
  select design into project_data from public.kitchen_garnitures where user_id=p_actor and id=p_source_id for share;
  if not found then raise exception using errcode='P0002',message='Kitchen project not found'; end if;
  cabinets:=project_data->'cabinets';
  if jsonb_typeof(cabinets) is distinct from 'array' or jsonb_array_length(cabinets) not between 1 and 80 then
    raise exception using errcode='22023',message='Invalid kitchen project';
  end if;
  select coalesce(jsonb_agg(value),'[]'::jsonb) into product_ids from (
    select distinct coalesce(nullif(cabinet->>'variantId',''),nullif(cabinet->>'productId','')) as value
    from jsonb_array_elements(cabinets) cabinet
    where coalesce(nullif(cabinet->>'variantId',''),nullif(cabinet->>'productId','')) is not null order by value
  ) ids;
  insert into public.kitchen_designs(store_id,created_by,source_garniture_id,slug)
    values(target_store.id,p_actor,p_source_id,p_slug) returning id into target_design;
  insert into public.kitchen_design_versions(design_id,version_no,title,short_description,description,design,style,layout,tags,
    pricing_mode,price_from,lead_time_days,installation_included,warranty_months,service_areas,inclusions,exclusions,
    cabinet_count,base_count,wall_count,tall_count,min_room_width_mm,min_room_depth_mm,max_height_mm,component_product_ids,created_by)
  select target_design,1,p_payload->>'title',coalesce(p_payload->>'shortDescription',''),coalesce(p_payload->>'description',''),
    project_data,coalesce(p_payload->>'style','modern'),coalesce(project_data->>'layout','straight'),coalesce(p_payload->'tags','[]'::jsonb),
    coalesce(p_payload->>'pricingMode','quote'),nullif(p_payload->>'priceFrom','')::bigint,
    nullif(p_payload->>'leadTimeDays','')::integer,coalesce((p_payload->>'installationIncluded')::boolean,false),
    nullif(p_payload->>'warrantyMonths','')::integer,coalesce(p_payload->'serviceAreas','[]'::jsonb),
    coalesce(p_payload->'inclusions','[]'::jsonb),coalesce(p_payload->'exclusions','[]'::jsonb),
    jsonb_array_length(cabinets),
    (select count(*) from jsonb_array_elements(cabinets) c where c->>'type'='base'),
    (select count(*) from jsonb_array_elements(cabinets) c where c->>'type'='wall'),
    (select count(*) from jsonb_array_elements(cabinets) c where c->>'type'='tall'),
    (project_data#>>'{room,width}')::integer,(project_data#>>'{room,depth}')::integer,
    (select max((c->>'height')::integer+(c#>>'{position,y}')::integer) from jsonb_array_elements(cabinets) c),
    product_ids,p_actor returning id into target_version;
  return jsonb_build_object('designId',target_design,'versionId',target_version);
end;
$$;

revoke all on function public.save_kitchen_module_variant(uuid,uuid,uuid,jsonb),
  public.set_kitchen_module_variant_active(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.save_kitchen_module_variant(uuid,uuid,uuid,jsonb),
  public.set_kitchen_module_variant_active(uuid,uuid,boolean) to service_role;

notify pgrst,'reload schema';
commit;
