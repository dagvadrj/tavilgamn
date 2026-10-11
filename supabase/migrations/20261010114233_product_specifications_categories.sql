-- Furniture specification metadata and the canonical category snapshot.
-- Timestamp reconciled with the migration applied through the connected Supabase tool.
begin;

create or replace function public.is_furniture_category(value text)
returns boolean language sql immutable set search_path='' as $$
  select coalesce(value in ('sofa','bed','dining-table','wardrobe','office','tv-stand','bookshelf','kitchen-cabinet','oven','chair','armchair','coffee-table','side-table','desk','office-chair','dresser','nightstand','shoe-rack','storage-shelf','mattress','bathroom-cabinet','bench'), false);
$$;
revoke all on function public.is_furniture_category(text) from public;
grant execute on function public.is_furniture_category(text) to anon,authenticated,service_role;
alter table public.furniture_models drop constraint if exists furniture_models_category_check;
alter table public.furniture_models add constraint furniture_models_category_check check(public.is_furniture_category(category));

create function public.valid_furniture_specifications(value jsonb)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare item record;
begin
  if value is null or jsonb_typeof(value) <> 'object' then return false; end if;
  if (select count(*) from jsonb_each(value)) > 30 then return false; end if;
  for item in select * from jsonb_each(value) loop
    if item.key not in ('type','materialDetail','assembly','style','warranty','tiers','loadCapacity','doors','drawers','storage','seats','upholstery','seatHeight','shape','extendable','mattressSize','headboard','convertible','adjustment','firmness','thickness','filling','power','capacity','energyClass')
      or jsonb_typeof(item.value) <> 'string' or length(item.value #>> '{}') > 300 then return false; end if;
  end loop;
  return true;
end $$;
revoke all on function public.valid_furniture_specifications(jsonb) from public,anon,authenticated;
grant execute on function public.valid_furniture_specifications(jsonb) to service_role;

alter table public.furniture_models add column specifications jsonb not null default '{}',
  add constraint furniture_specifications_valid check(public.valid_furniture_specifications(specifications));
comment on column public.furniture_models.specifications is 'Category-specific furniture details. Dimensions, selectable colors and materials remain in their existing authoritative columns.';

-- Delegate to the existing commerce/stock CAS implementation, within one transaction.
alter function public.save_furniture_product(jsonb,boolean,integer) rename to save_furniture_product_pre_specifications;
create function public.save_furniture_product(p_data jsonb,p_create boolean,p_expected_stock integer default null)
returns void language plpgsql security invoker set search_path='' as $$
begin
  if p_data ? 'specifications' and not public.valid_furniture_specifications(p_data->'specifications') then
    raise exception using errcode='22023',message='Invalid furniture specifications';
  end if;
  perform public.save_furniture_product_pre_specifications(p_data,p_create,p_expected_stock);
  if p_data ? 'specifications' then
    update public.furniture_models set specifications=p_data->'specifications' where product_id=p_data->>'id';
  end if;
end $$;
revoke all on function public.save_furniture_product(jsonb,boolean,integer),public.save_furniture_product_pre_specifications(jsonb,boolean,integer) from public,anon,authenticated;
grant execute on function public.save_furniture_product(jsonb,boolean,integer),public.save_furniture_product_pre_specifications(jsonb,boolean,integer) to service_role;
notify pgrst,'reload schema';
commit;
