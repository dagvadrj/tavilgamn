-- Multiple product images for the separate photo gallery.
begin;

alter table public.furniture_models
  add column if not exists images jsonb not null default '[]'::jsonb;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'furniture_images_array'
      and conrelid = 'public.furniture_models'::regclass
  ) then
    alter table public.furniture_models
      add constraint furniture_images_array
      check (jsonb_typeof(images) = 'array' and jsonb_array_length(images) <= 12);
  end if;
end $$;

create or replace function public.save_furniture_product(
  p_data jsonb,
  p_create boolean,
  p_expected_stock integer default null
)
returns void language plpgsql security invoker set search_path='' as $$
declare target_id uuid; current_stock integer; gallery jsonb;
begin
  if jsonb_typeof(p_data->'stockQuantity') is distinct from 'number'
    or p_data->>'stockQuantity' !~ '^[0-9]+$'
    or (p_data->>'stockQuantity')::numeric > 1000000 then
    raise exception using errcode='22023', message='Invalid stock quantity';
  end if;

  gallery := coalesce(p_data->'images', '[]'::jsonb);
  if jsonb_typeof(gallery) is distinct from 'array' or jsonb_array_length(gallery) > 12 then
    raise exception using errcode='22023', message='Invalid product gallery';
  end if;

  if p_create then
    insert into public.furniture_models(
      id,product_id,name,category,description,base_price,glb_path,scale,
      dimensions_w,dimensions_d,dimensions_h,colors,materials,in_stock,images
    ) values(
      gen_random_uuid(),p_data->>'id',p_data->>'name',p_data->>'category',coalesce(p_data->>'description',''),
      (p_data->>'basePrice')::bigint,null,1,
      (p_data#>>'{dimensions,w}')::double precision,
      (p_data#>>'{dimensions,d}')::double precision,
      (p_data#>>'{dimensions,h}')::double precision,
      p_data->'colors',p_data->'materials',(p_data->>'stockQuantity')::integer,gallery
    ) returning id into target_id;
  else
    select id,in_stock into target_id,current_stock
    from public.furniture_models where product_id=p_data->>'id' for update;
    if not found then raise exception using errcode='P0002',message='Product not found'; end if;
    if current_stock is distinct from p_expected_stock then
      raise exception using errcode='P0003',message='Stock changed';
    end if;
  end if;

  update public.furniture_models set
    name=p_data->>'name', category=p_data->>'category',
    description=coalesce(p_data->>'description',''),
    base_price=(p_data->>'basePrice')::bigint,
    image_url=p_data->>'image', images=gallery,
    colors=p_data->'colors', materials=p_data->'materials',
    default_color=p_data->>'defaultColor',
    dimensions_w=(p_data#>>'{dimensions,w}')::double precision,
    dimensions_d=(p_data#>>'{dimensions,d}')::double precision,
    dimensions_h=(p_data#>>'{dimensions,h}')::double precision,
    in_stock=(p_data->>'stockQuantity')::integer,
    rating=coalesce((p_data->>'rating')::numeric,0),
    review_count=coalesce((p_data->>'reviewCount')::integer,0),
    badges=coalesce(p_data->'badges','[]'),
    is_new=coalesce((p_data->>'isNew')::boolean,false),
    is_best_seller=coalesce((p_data->>'isBestSeller')::boolean,false),
    store_ids=coalesce(p_data->'storeIds','[]'), updated_at=now()
  where id=target_id;
end $$;

revoke all on function public.save_furniture_product(jsonb,boolean,integer)
  from public,anon,authenticated;
grant execute on function public.save_furniture_product(jsonb,boolean,integer)
  to service_role;

notify pgrst, 'reload schema';
commit;
