create or replace function public.copy_kitchen_project_thumbnail_to_marketplace() returns trigger
language plpgsql security invoker set search_path='' as $$
declare project_thumbnail text; project_name text;
begin
  select g.thumbnail_url,g.name into project_thumbnail,project_name
  from public.kitchen_designs d
  join public.kitchen_garnitures g on g.id=d.source_garniture_id and g.user_id=d.created_by
  where d.id=new.design_id;
  if project_thumbnail is not null then
    insert into public.kitchen_design_media(version_id,kind,source,url,alt_text,is_primary,metadata)
    values(new.id,'thumbnail','system',project_thumbnail,left(coalesce(project_name,new.title),300),true,
      jsonb_build_object('origin','planner_3d_capture'));
  end if;
  return new;
end;
$$;

create function public.save_kitchen_marketplace_version(
  p_actor uuid,p_design uuid,p_version uuid,p_mode text,p_payload jsonb
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare target_design public.kitchen_designs; current_version public.kitchen_design_versions;
  project_data jsonb; cabinets jsonb; product_ids jsonb; target_version uuid; next_version integer;
begin
  perform 1 from public.profiles where id=p_actor and role='merchant' for share;
  if not found then raise exception using errcode='42501',message='Merchant required'; end if;
  select d.* into target_design
  from public.kitchen_designs d join public.merchant_stores s on s.id=d.store_id
  where d.id=p_design and d.created_by=p_actor and s.owner_id=p_actor and s.active
    and s.store_type in ('factory','handmade') and d.publication_status not in ('archived','suspended')
  for update of d;
  if not found then raise exception using errcode='42501',message='Kitchen design owner required'; end if;
  select * into current_version from public.kitchen_design_versions
  where design_id=p_design order by version_no desc limit 1 for update;
  if not found or current_version.id<>p_version then
    raise exception using errcode='P0012',message='Stale kitchen version';
  end if;
  if p_mode='edit' then
    if current_version.review_status not in ('draft','changes_requested') then
      raise exception using errcode='P0012',message='Kitchen version is not editable';
    end if;
    update public.kitchen_design_versions set
      title=p_payload->>'title',short_description=coalesce(p_payload->>'shortDescription',''),
      description=coalesce(p_payload->>'description',''),style=coalesce(p_payload->>'style','modern'),
      tags=coalesce(p_payload->'tags','[]'::jsonb),pricing_mode=coalesce(p_payload->>'pricingMode','quote'),
      price_from=nullif(p_payload->>'priceFrom','')::bigint,
      lead_time_days=nullif(p_payload->>'leadTimeDays','')::integer,
      installation_included=coalesce((p_payload->>'installationIncluded')::boolean,false),
      warranty_months=nullif(p_payload->>'warrantyMonths','')::integer,
      service_areas=coalesce(p_payload->'serviceAreas','[]'::jsonb),
      inclusions=coalesce(p_payload->'inclusions','[]'::jsonb),
      exclusions=coalesce(p_payload->'exclusions','[]'::jsonb)
    where id=current_version.id;
    update public.kitchen_designs set updated_at=clock_timestamp() where id=p_design;
    return jsonb_build_object('designId',p_design,'versionId',current_version.id,
      'versionNo',current_version.version_no,'created',false);
  end if;
  if p_mode<>'new_version' or not (
    current_version.review_status='rejected' or
    (target_design.publication_status='published' and target_design.published_version_id=current_version.id)
  ) then raise exception using errcode='P0012',message='New kitchen version is not allowed'; end if;
  select design into project_data from public.kitchen_garnitures
    where user_id=p_actor and id=target_design.source_garniture_id for share;
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
  next_version:=current_version.version_no+1;
  insert into public.kitchen_design_versions(design_id,version_no,title,short_description,description,design,style,layout,tags,
    pricing_mode,price_from,lead_time_days,installation_included,warranty_months,service_areas,inclusions,exclusions,
    cabinet_count,base_count,wall_count,tall_count,min_room_width_mm,min_room_depth_mm,max_height_mm,component_product_ids,created_by)
  select p_design,next_version,p_payload->>'title',coalesce(p_payload->>'shortDescription',''),coalesce(p_payload->>'description',''),
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
  update public.kitchen_designs set updated_at=clock_timestamp() where id=p_design;
  return jsonb_build_object('designId',p_design,'versionId',target_version,'versionNo',next_version,'created',true);
end;
$$;

revoke all on function public.save_kitchen_marketplace_version(uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.save_kitchen_marketplace_version(uuid,uuid,uuid,text,jsonb) to service_role;
notify pgrst,'reload schema';
