-- Single runtime source for store profiles. Existing IDs and product store_ids stay unchanged.
-- Generated category enforcement snapshot from src/lib/catalogCategories.ts.
begin;
alter table public.merchant_stores alter column owner_id drop not null;

create or replace function public.is_furniture_category(value text)
returns boolean language sql immutable set search_path='' as $$
  select coalesce(value in ('sofa','bed','dining-table','wardrobe','office','tv-stand','bookshelf','kitchen-cabinet','oven'), false);
$$;
revoke all on function public.is_furniture_category(text) from public;
grant execute on function public.is_furniture_category(text) to anon, authenticated, service_role;

alter table public.furniture_models drop constraint if exists furniture_models_category_check;
alter table public.furniture_models add constraint furniture_models_category_check
  check (public.is_furniture_category(category));

create or replace function public.save_merchant_store(p_actor uuid,p_data jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result public.merchant_stores;
begin
  perform 1 from public.profiles where id=p_actor and role='merchant' for share;
  if not found then raise exception using errcode='42501',message='Merchant required'; end if;
  if exists(select 1 from public.merchant_stores where owner_id=p_actor and not active) then
    raise exception using errcode='42501',message='Store disabled';
  end if;
  if jsonb_typeof(p_data->'categories') is distinct from 'array'
    or exists(select 1 from jsonb_array_elements_text(p_data->'categories') c where not public.is_furniture_category(c)) then
    raise exception using errcode='22023',message='Invalid categories';
  end if;
  insert into public.merchant_stores(owner_id,store_type,name,city,district,address,phone,description,image,categories)
    values(p_actor,p_data->>'storeType',p_data->>'name',p_data->>'city',p_data->>'district',p_data->>'address',p_data->>'phone',p_data->>'description',p_data->>'image',p_data->'categories')
  on conflict(owner_id) do update set store_type=excluded.store_type,name=excluded.name,city=excluded.city,district=excluded.district,
    address=excluded.address,phone=excluded.phone,description=excluded.description,image=excluded.image,categories=excluded.categories,updated_at=now()
  returning * into result;
  return to_jsonb(result)-'owner_id';
end $$;
revoke all on function public.save_merchant_store(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_merchant_store(uuid,jsonb) to service_role;

create or replace function public.snapshot_merchant_order()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  line jsonb;
  stores jsonb;
  merchant public.merchant_stores;
begin
  for line in select value from jsonb_array_elements(new.items) loop
    select store_ids into stores
    from public.furniture_models
    where product_id = line->>'productId';

    if not exists(
      select 1
      from public.merchant_stores s
      where stores ? s.id and s.owner_id is not null
    ) then
      continue;
    end if;

    if jsonb_typeof(stores) is distinct from 'array'
       or jsonb_array_length(stores) <> 1 then
      raise exception using
        errcode='P0008',
        message='Ambiguous merchant ownership';
    end if;

    select s.* into merchant
    from public.merchant_stores s
    join public.profiles p on p.id = s.owner_id
    where s.id = stores->>0
      and s.active
      and p.role = 'merchant'
    for share of p, s nowait;

    if not found then
      raise exception using
        errcode='P0008',
        message='Merchant unavailable';
    end if;
  end loop;

  insert into public.merchant_order_fulfillments(
    order_id,
    store_id,
    owner_id,
    items,
    subtotal,
    commission_bps,
    created_at
  )
  select
    new.id,
    s.id,
    s.owner_id,
    jsonb_agg(x.line order by x.ordinal),
    sum((x.line->>'lineTotal')::bigint),
    s.commission_bps,
    new.created_at
  from jsonb_array_elements(new.items)
    with ordinality as x(line, ordinal)
  join public.furniture_models m
    on m.product_id = x.line->>'productId'
  join public.merchant_stores s
    on m.store_ids = jsonb_build_array(s.id) and s.owner_id is not null
  group by s.id, s.owner_id, s.commission_bps;

  return new;

exception
  when lock_not_available then
    raise exception using
      errcode='P0008',
      message='Merchant availability changed; retry checkout';
end
$function$;


insert into public.merchant_stores(id,store_type,name,city,district,address,phone,description,image,categories)
values
  ('top-mebel','retail','Топ Мебель','Улаанбаатар','Баянзүрх дүүрэг','1-р хороо, Токиогийн гудамж','11-456155','1994 оноос үйл ажиллагаа явуулж буй, зах зээлд тэргүүлэгч тавилгын томоохон дэлгүүрүүдийн нэг.','https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=1200&q=80','["sofa","bed","wardrobe","office"]'::jsonb),
  ('gobi-khangai-mebel','retail','Говь Хангай мебель','Улаанбаатар','3, 4-р хороолол','И-март дэлгүүрийн хажууд, Хаан банктай байрны 2 давхарт','9904-0828','3, 4-р хороололд байрлах, өргөн сонголттой тавилгын их дэлгүүр.','https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1200&q=80','["sofa","dining-table","bed"]'::jsonb),
  ('mebel-town','retail','Мебель Таун','Улаанбаатар','Мишээл Экспо төв','Мишээл Экспо төв, Мебель Таун салбар','77199999','Олон брэндийн тавилгыг нэг дор санал болгодог, салбар сүлжээтэй том худалдааны төв.','https://images.unsplash.com/photo-1555636222-cae831e670b3?auto=format&fit=crop&w=1200&q=80','["sofa","bed","wardrobe","tv-stand","office","bookshelf"]'::jsonb),
  ('sunder-urguu-trade','factory','Сүндэр Өргөө Трейд','Улаанбаатар','Баянзүрх дүүрэг','Их тойруу, Ундрам плаза, 10 давхар','-','Герман технологиор тавилга үйлдвэрлэдэг, захиалгат тавилгын үйлчилгээ үзүүлдэг компани.','https://images.unsplash.com/photo-1631679706909-1844bbd07221?auto=format&fit=crop&w=1200&q=80','["sofa","office","wardrobe"]'::jsonb),
  ('magnetto','factory','Магнетто','Улаанбаатар','-','-','-','Итали, Герман, Австри, Солонгосын чанартай материал ашигладаг тавилгын үйлдвэр, гал тогоо болон унтлагын өрөөний тавилга мэргэшсэн.','https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1200&q=80','["sofa","bed","bookshelf","office","dining-table"]'::jsonb),
  ('stolline-mongolia','retail','Stolline дэлгүүр','Улаанбаатар','3, 4-р хороолол','И-март дэлгүүрийн хажууд, Хаан банктай байрны 2 давхарт','-','Оросын Stolline фабрикийн албан ёсны борлуулагч, буйдан, ширээ сандал, комод худалдаалдаг.','https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=1200&q=80','["sofa","dining-table","office"]'::jsonb),
  ('tumen-tavilga','factory','Түмэн тавилгын дэлгүүр','Улаанбаатар','-','-','-','Монголд үйлдвэрлэдэг үндэсний тавилгын брэнд, E1 стандартын хавтангаар бүх төрлийн тавилга хийдэг.','https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=1200&q=80','["wardrobe","office","bed"]'::jsonb),
  ('khairyn-ger','factory','Хайрын Гэр','Улаанбаатар','Хан-Уул дүүрэг','Богд Жавзандамбын гудамж','9901-8121','Гэр болон албан тасалгаанд зориулсан захиалгат тавилгын зураг төсөл гарган үйлдвэрлэдэг компани.','https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80','["office","bookshelf","wardrobe"]'::jsonb),
  ('shine-songolt','retail','Шинэ Сонголт брэнд тавилгын их дэлгүүр','Улаанбаатар','-','-','-','Ялангуяа хүүхдийн тавилга буюу нэг болон давхар ортой, олон үйлдэлтэй тавилгаараа алдартай их дэлгүүр.','https://images.unsplash.com/photo-1567016432779-094069958ea5?auto=format&fit=crop&w=1200&q=80','["bed","wardrobe"]'::jsonb),
  ('best-buidan','retail','Бест Буйдан','Улаанбаатар','-','-','77776060','Чанар, дизайны олон сонголттой буйдан голлон худалдаалдаг тавилгын дэлгүүр.','https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1200&q=80','["sofa"]'::jsonb),
  ('mungun-tavilga','retail','Мөнгөн Тавилга','Улаанбаатар','Цэцэг төвийн худалдааны гудамж','Цэцэг төв, Худалдааны гудамж','-','Цэцэг төвийн худалдааны гудамжинд байрлах тавилгын дэлгүүрүүдийн нэг.','https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=80','["sofa","dining-table","office"]'::jsonb),
  ('badachi-trade','retail','Бадачи Треид (Топмебель эх дэлгүүр)','Улаанбаатар','-','-','-','1991 онд байгуулагдсан, 1994 оноос тавилгын чиглэлээр ажилладаг Топмебелийг үүсгэн байгуулсан компани.','https://images.unsplash.com/photo-1540574163026-643ea20ade25?auto=format&fit=crop&w=1200&q=80','["sofa","bed","wardrobe","office"]'::jsonb),
  ('narnia-mebel','retail','Нарниа Мебель','Улаанбаатар','-','-','-','Оффис болон гэр ахуйн тавилга худалдаалдаг дэлгүүрүүдийн нэг.','https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80','["office","bookshelf","tv-stand"]'::jsonb)
on conflict(id) do nothing;
commit;
