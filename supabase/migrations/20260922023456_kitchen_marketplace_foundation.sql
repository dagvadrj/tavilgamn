begin;

-- Kitchen variants are sellable catalog rows. Keep price, inventory, merchant
-- ownership and the single runtime GLB in furniture_models instead of creating
-- a second product/asset system.
alter table public.furniture_models drop constraint furniture_models_category_check;
alter table public.furniture_models add constraint furniture_models_category_check
  check (category in ('sofa','wardrobe','dining-table','office','bed','tv-stand','bookshelf','kitchen-cabinet'));

create table public.material_definitions (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  surface_kind text not null check (surface_kind in ('general','carcass','front','countertop','handle','appliance')),
  base_color text not null check (base_color ~ '^#[0-9A-Fa-f]{6}$'),
  roughness numeric(4,3) not null check (roughness between 0 and 1),
  metalness numeric(4,3) not null default 0 check (metalness between 0 and 1),
  texture_paths jsonb not null default '{}' check (jsonb_typeof(texture_paths)='object' and octet_length(texture_paths::text)<=20000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.material_definitions(id,name,surface_kind,base_color,roughness,metalness) values
  ('matte','Матт','general','#DDD8CC',0.850,0),
  ('gloss','Гялгар','general','#FAF8F2',0.150,0),
  ('oak','Царс','general','#BB915E',0.650,0),
  ('walnut','Хушга','general','#69503C',0.650,0),
  ('marble','Гантиг','countertop','#EEEAE3',0.300,0),
  ('concrete','Бетон','countertop','#96958E',0.950,0)
on conflict(id) do nothing;

create table public.kitchen_modules (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9][A-Z0-9_-]{1,79}$'),
  name text not null check (char_length(btrim(name)) between 1 and 160),
  cabinet_type text not null check (cabinet_type in ('base','wall','tall','corner','appliance')),
  width_mm integer not null check (width_mm between 100 and 3000),
  height_mm integer not null check (height_mm between 100 and 4000),
  depth_mm integer not null check (depth_mm between 100 and 1500),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.kitchen_module_variants (
  furniture_model_id uuid primary key references public.furniture_models(id) on delete restrict,
  module_id uuid not null references public.kitchen_modules(id) on delete restrict,
  variant_code text not null check (variant_code ~ '^[A-Z0-9][A-Z0-9_-]{1,79}$'),
  opening text not null check (opening in ('doors','drawers','open','sink','hob','oven','hood','refrigerator')),
  door_count integer not null default 0 check (door_count between 0 and 2),
  drawer_count integer not null default 0 check (drawer_count between 0 and 4),
  configuration jsonb not null default '{}' check (jsonb_typeof(configuration)='object' and octet_length(configuration::text)<=50000),
  is_default boolean not null default false,
  sort_order integer not null default 0 check (sort_order between 0 and 10000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(module_id,variant_code)
);
create unique index kitchen_module_one_default_idx on public.kitchen_module_variants(module_id) where is_default;
create index kitchen_module_variants_module_idx on public.kitchen_module_variants(module_id,sort_order,furniture_model_id);

-- Listing identity is stable; content lives in immutable reviewable versions.
-- A published version remains live while a merchant prepares the next version.
create table public.kitchen_designs (
  id uuid primary key default gen_random_uuid(),
  store_id text not null references public.merchant_stores(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  source_garniture_id uuid,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,99}$'),
  publication_status text not null default 'draft' check (publication_status in ('draft','published','archived','suspended')),
  published_version_id uuid,
  featured boolean not null default false,
  featured_rank integer check (featured_rank is null or featured_rank between 1 and 10000),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index kitchen_designs_store_updated_idx on public.kitchen_designs(store_id,updated_at desc,id);
create index kitchen_designs_created_by_idx on public.kitchen_designs(created_by);
create index kitchen_designs_marketplace_idx on public.kitchen_designs(featured desc,featured_rank,published_at desc,id)
  where publication_status='published';

create table public.kitchen_design_versions (
  id uuid primary key default gen_random_uuid(),
  design_id uuid not null references public.kitchen_designs(id) on delete cascade,
  version_no integer not null check (version_no between 1 and 10000),
  review_status text not null default 'draft' check (review_status in ('draft','submitted','changes_requested','approved','rejected')),
  title text not null check (char_length(btrim(title)) between 3 and 160),
  short_description text not null default '' check (char_length(short_description)<=300),
  description text not null default '' check (char_length(description)<=10000),
  design jsonb not null check (jsonb_typeof(design)='object' and octet_length(design::text)<=250000),
  style text not null default 'modern' check (style ~ '^[a-z0-9][a-z0-9_-]{0,49}$'),
  layout text not null check (layout in ('straight','l-left','l-right','double-side')),
  tags jsonb not null default '[]' check (jsonb_typeof(tags)='array' and jsonb_array_length(tags)<=20),
  pricing_mode text not null default 'quote' check (pricing_mode in ('fixed','from','quote')),
  price_from bigint check (price_from is null or price_from>=0),
  currency text not null default 'MNT' check (currency='MNT'),
  lead_time_days integer check (lead_time_days is null or lead_time_days between 1 and 365),
  installation_included boolean not null default false,
  warranty_months integer check (warranty_months is null or warranty_months between 0 and 120),
  service_areas jsonb not null default '[]' check (jsonb_typeof(service_areas)='array' and jsonb_array_length(service_areas)<=50),
  inclusions jsonb not null default '[]' check (jsonb_typeof(inclusions)='array' and jsonb_array_length(inclusions)<=50),
  exclusions jsonb not null default '[]' check (jsonb_typeof(exclusions)='array' and jsonb_array_length(exclusions)<=50),
  cabinet_count integer not null check (cabinet_count between 1 and 80),
  base_count integer not null default 0 check (base_count between 0 and 80),
  wall_count integer not null default 0 check (wall_count between 0 and 80),
  tall_count integer not null default 0 check (tall_count between 0 and 80),
  min_room_width_mm integer not null check (min_room_width_mm between 1000 and 20000),
  min_room_depth_mm integer not null check (min_room_depth_mm between 1000 and 20000),
  max_height_mm integer not null check (max_height_mm between 100 and 10000),
  component_product_ids jsonb not null default '[]' check (jsonb_typeof(component_product_ids)='array'),
  calculated_price bigint check (calculated_price is null or calculated_price>=0),
  calculated_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  submitted_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(design_id,version_no),
  unique(design_id,id),
  check (pricing_mode='quote' or price_from is not null)
);
create index kitchen_design_versions_design_idx on public.kitchen_design_versions(design_id,version_no desc);
create index kitchen_design_versions_review_idx on public.kitchen_design_versions(review_status,submitted_at,id)
  where review_status in ('submitted','changes_requested');
alter table public.kitchen_designs add constraint kitchen_designs_published_version_fkey
  foreign key(id,published_version_id) references public.kitchen_design_versions(design_id,id) on delete restrict;
alter table public.kitchen_designs add constraint kitchen_designs_published_version_required
  check (publication_status<>'published' or published_version_id is not null);
create index kitchen_designs_published_version_fk_idx on public.kitchen_designs(id,published_version_id);
create index kitchen_design_versions_created_by_idx on public.kitchen_design_versions(created_by);

create table public.kitchen_design_media (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.kitchen_design_versions(id) on delete cascade,
  kind text not null check (kind in ('thumbnail','render','ai_render','photo','plan')),
  source text not null check (source in ('system','merchant','ai')),
  url text not null check (char_length(url) between 8 and 2000),
  alt_text text not null default '' check (char_length(alt_text)<=300),
  sort_order integer not null default 0 check (sort_order between 0 and 10000),
  is_primary boolean not null default false,
  width integer check (width is null or width between 1 and 20000),
  height integer check (height is null or height between 1 and 20000),
  status text not null default 'ready' check (status in ('pending','ready','failed','rejected')),
  metadata jsonb not null default '{}' check (jsonb_typeof(metadata)='object' and octet_length(metadata::text)<=50000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index kitchen_design_media_primary_idx on public.kitchen_design_media(version_id) where is_primary and status='ready';
create index kitchen_design_media_version_idx on public.kitchen_design_media(version_id,sort_order,id);

create table public.kitchen_design_reviews (
  id uuid primary key default gen_random_uuid(),
  design_id uuid not null references public.kitchen_designs(id) on delete cascade,
  version_id uuid references public.kitchen_design_versions(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in ('approved','changes_requested','rejected','unpublished')),
  note text not null default '' check (char_length(note)<=5000),
  created_at timestamptz not null default now()
);
create index kitchen_design_reviews_design_idx on public.kitchen_design_reviews(design_id,created_at desc,id);
create index kitchen_design_reviews_version_idx on public.kitchen_design_reviews(version_id) where version_id is not null;
create index kitchen_design_reviews_reviewer_idx on public.kitchen_design_reviews(reviewer_id);

create table public.kitchen_render_jobs (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.kitchen_design_versions(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'queued' check (status in ('queued','processing','completed','failed','cancelled')),
  input_image_url text check (input_image_url is null or char_length(input_image_url)<=2000),
  prompt_snapshot text not null default '' check (char_length(prompt_snapshot)<=10000),
  provider text check (provider is null or char_length(provider)<=100),
  model text check (model is null or char_length(model)<=200),
  output_media_id uuid references public.kitchen_design_media(id) on delete set null,
  error text check (error is null or char_length(error)<=5000),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create index kitchen_render_jobs_version_idx on public.kitchen_render_jobs(version_id,created_at desc,id);
create index kitchen_render_jobs_queue_idx on public.kitchen_render_jobs(created_at,id) where status='queued';
create index kitchen_render_jobs_requested_by_idx on public.kitchen_render_jobs(requested_by);
create index kitchen_render_jobs_output_media_idx on public.kitchen_render_jobs(output_media_id) where output_media_id is not null;

create function public.touch_kitchen_marketplace_updated_at() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  new.updated_at=clock_timestamp();
  return new;
end;
$$;
revoke all on function public.touch_kitchen_marketplace_updated_at() from public,anon,authenticated;
grant execute on function public.touch_kitchen_marketplace_updated_at() to service_role;

create trigger material_definitions_updated before update on public.material_definitions for each row execute function public.touch_kitchen_marketplace_updated_at();
create trigger kitchen_modules_updated before update on public.kitchen_modules for each row execute function public.touch_kitchen_marketplace_updated_at();
create trigger kitchen_module_variants_updated before update on public.kitchen_module_variants for each row execute function public.touch_kitchen_marketplace_updated_at();
create trigger kitchen_designs_updated before update on public.kitchen_designs for each row execute function public.touch_kitchen_marketplace_updated_at();
create trigger kitchen_design_versions_updated before update on public.kitchen_design_versions for each row execute function public.touch_kitchen_marketplace_updated_at();
create trigger kitchen_design_media_updated before update on public.kitchen_design_media for each row execute function public.touch_kitchen_marketplace_updated_at();

alter table public.material_definitions enable row level security;
alter table public.kitchen_modules enable row level security;
alter table public.kitchen_module_variants enable row level security;
alter table public.kitchen_designs enable row level security;
alter table public.kitchen_design_versions enable row level security;
alter table public.kitchen_design_media enable row level security;
alter table public.kitchen_design_reviews enable row level security;
alter table public.kitchen_render_jobs enable row level security;

revoke all on public.material_definitions,public.kitchen_modules,public.kitchen_module_variants,
  public.kitchen_designs,public.kitchen_design_versions,public.kitchen_design_media,
  public.kitchen_design_reviews,public.kitchen_render_jobs from public,anon,authenticated;
grant select on public.material_definitions,public.kitchen_modules,public.kitchen_module_variants,
  public.kitchen_designs,public.kitchen_design_versions,public.kitchen_design_media to anon,authenticated;
grant all on public.material_definitions,public.kitchen_modules,public.kitchen_module_variants,
  public.kitchen_designs,public.kitchen_design_versions,public.kitchen_design_media,
  public.kitchen_design_reviews,public.kitchen_render_jobs to service_role;

create policy material_definitions_public on public.material_definitions for select to anon,authenticated using(active);
create policy kitchen_modules_public on public.kitchen_modules for select to anon,authenticated using(active);
create policy kitchen_module_variants_public on public.kitchen_module_variants for select to anon,authenticated using(active);
create policy kitchen_designs_public on public.kitchen_designs for select to anon,authenticated using(publication_status='published');
create policy kitchen_design_versions_public on public.kitchen_design_versions for select to anon,authenticated using(
  exists(select 1 from public.kitchen_designs d where d.id=design_id and d.publication_status='published' and d.published_version_id=kitchen_design_versions.id)
);
create policy kitchen_design_media_public on public.kitchen_design_media for select to anon,authenticated using(
  status='ready' and exists(
    select 1 from public.kitchen_design_versions v join public.kitchen_designs d on d.id=v.design_id
    where v.id=version_id and d.publication_status='published' and d.published_version_id=v.id
  )
);
create policy kitchen_design_reviews_private on public.kitchen_design_reviews for all to anon,authenticated using(false) with check(false);
create policy kitchen_render_jobs_private on public.kitchen_render_jobs for all to anon,authenticated using(false) with check(false);

-- Atomic, server-only workflow functions. The actor is authenticated by the
-- Next.js route before calling; each function re-checks profile/store ownership.
create function public.create_kitchen_marketplace_design(
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

create function public.submit_kitchen_design(p_actor uuid,p_design uuid,p_version uuid)
returns void language plpgsql security invoker set search_path='' as $$
begin
  perform 1 from public.kitchen_designs d join public.merchant_stores s on s.id=d.store_id
    join public.kitchen_design_versions v on v.design_id=d.id
    where d.id=p_design and v.id=p_version and d.created_by=p_actor and s.owner_id=p_actor and s.active
      and s.store_type in ('factory','handmade') and d.publication_status<>'archived'
      and v.review_status in ('draft','changes_requested') for share of d,s,v;
  if not found then raise exception using errcode='42501',message='Kitchen draft not available'; end if;
  if not exists(select 1 from public.kitchen_design_media m where m.version_id=p_version and m.kind='thumbnail' and m.is_primary and m.status='ready') then
    raise exception using errcode='P0010',message='Primary thumbnail required';
  end if;
  update public.kitchen_design_versions set review_status='submitted',submitted_at=now() where id=p_version;
end;
$$;

create function public.publish_kitchen_design(p_actor uuid,p_design uuid,p_version uuid)
returns void language plpgsql security invoker set search_path='' as $$
begin
  perform 1 from public.kitchen_designs d join public.merchant_stores s on s.id=d.store_id
    join public.kitchen_design_versions v on v.design_id=d.id
    where d.id=p_design and v.id=p_version and d.created_by=p_actor and s.owner_id=p_actor and s.active
      and s.store_type in ('factory','handmade') and v.review_status='approved' for update of d;
  if not found then raise exception using errcode='42501',message='Approved kitchen design required'; end if;
  update public.kitchen_designs set publication_status='published',published_version_id=p_version,
    published_at=coalesce(published_at,now()) where id=p_design;
end;
$$;

create function public.archive_kitchen_design(p_actor uuid,p_design uuid)
returns void language plpgsql security invoker set search_path='' as $$
begin
  perform 1 from public.kitchen_designs d join public.merchant_stores s on s.id=d.store_id
    where d.id=p_design and d.created_by=p_actor and s.owner_id=p_actor for update of d;
  if not found then raise exception using errcode='42501',message='Kitchen design owner required'; end if;
  update public.kitchen_designs set publication_status='archived',published_version_id=null where id=p_design;
end;
$$;

create function public.add_kitchen_design_media(
  p_actor uuid,p_design uuid,p_version uuid,p_kind text,p_url text,p_alt text,
  p_primary boolean,p_width integer,p_height integer,p_metadata jsonb
) returns uuid language plpgsql security invoker set search_path='' as $$
declare media_id uuid;
begin
  perform 1 from public.kitchen_designs d join public.merchant_stores s on s.id=d.store_id
    join public.kitchen_design_versions v on v.design_id=d.id
    where d.id=p_design and v.id=p_version and d.created_by=p_actor and s.owner_id=p_actor and s.active
      and s.store_type in ('factory','handmade') and v.review_status in ('draft','changes_requested')
    for update of v;
  if not found then raise exception using errcode='42501',message='Editable kitchen version required'; end if;
  if p_kind not in ('thumbnail','render','photo','plan') then
    raise exception using errcode='22023',message='Invalid media kind';
  end if;
  if p_primary then
    update public.kitchen_design_media set is_primary=false where version_id=p_version and is_primary;
  end if;
  insert into public.kitchen_design_media(version_id,kind,source,url,alt_text,is_primary,width,height,metadata)
    values(p_version,p_kind,'merchant',p_url,coalesce(p_alt,''),p_primary,p_width,p_height,coalesce(p_metadata,'{}'::jsonb))
    returning id into media_id;
  return media_id;
end;
$$;

create function public.review_kitchen_design(p_actor uuid,p_design uuid,p_version uuid,p_action text,p_note text default '')
returns void language plpgsql security invoker set search_path='' as $$
begin
  perform 1 from public.profiles where id=p_actor and role='admin' for share;
  if not found then raise exception using errcode='42501',message='Admin required'; end if;
  if p_action not in ('approved','changes_requested','rejected','unpublished') then
    raise exception using errcode='22023',message='Invalid review action';
  end if;
  if p_action='unpublished' then
    perform 1 from public.kitchen_designs where id=p_design for update;
    if not found then raise exception using errcode='P0002',message='Kitchen design not found'; end if;
    update public.kitchen_designs set publication_status='suspended' where id=p_design;
  else
    perform 1 from public.kitchen_design_versions where id=p_version and design_id=p_design and review_status='submitted' for update;
    if not found then raise exception using errcode='P0002',message='Submitted kitchen version not found'; end if;
    update public.kitchen_design_versions set review_status=p_action,
      approved_at=case when p_action='approved' then now() else null end where id=p_version;
  end if;
  insert into public.kitchen_design_reviews(design_id,version_id,reviewer_id,action,note)
    values(p_design,case when p_action='unpublished' then null else p_version end,p_actor,p_action,coalesce(p_note,''));
end;
$$;

revoke all on function public.create_kitchen_marketplace_design(uuid,uuid,text,jsonb),
  public.submit_kitchen_design(uuid,uuid,uuid),public.publish_kitchen_design(uuid,uuid,uuid),
  public.archive_kitchen_design(uuid,uuid),
  public.add_kitchen_design_media(uuid,uuid,uuid,text,text,text,boolean,integer,integer,jsonb),
  public.review_kitchen_design(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.create_kitchen_marketplace_design(uuid,uuid,text,jsonb),
  public.submit_kitchen_design(uuid,uuid,uuid),public.publish_kitchen_design(uuid,uuid,uuid),
  public.archive_kitchen_design(uuid,uuid),
  public.add_kitchen_design_media(uuid,uuid,uuid,text,text,text,boolean,integer,integer,jsonb),
  public.review_kitchen_design(uuid,uuid,uuid,text,text) to service_role;

notify pgrst,'reload schema';
commit;
