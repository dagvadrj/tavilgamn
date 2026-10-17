-- Extend the existing specification contract without changing product IDs,
-- stock CAS, model ownership or the atomic save_furniture_product transaction.
begin;

create or replace function public.valid_furniture_specifications(value jsonb)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare item record; rooms jsonb;
begin
  if value is null or jsonb_typeof(value) <> 'object' then return false; end if;
  if (select count(*) from jsonb_each(value)) > 30 then return false; end if;
  for item in select * from jsonb_each(value) loop
    if item.key not in ('type','materialDetail','assembly','style','warranty','tiers','loadCapacity','doors','drawers','storage','seats','upholstery','seatHeight','shape','extendable','mattressSize','headboard','convertible','adjustment','firmness','thickness','filling','power','capacity','energyClass','plannerRoomTypes')
      or jsonb_typeof(item.value) <> 'string' or length(item.value #>> '{}') > 300 then return false; end if;
    if item.key = 'plannerRoomTypes' then
      begin
        rooms := (item.value #>> '{}')::jsonb;
      exception when invalid_text_representation then return false;
      end;
      if jsonb_typeof(rooms) <> 'array' then return false; end if;
      if jsonb_array_length(rooms) > 6 then return false; end if;
      if exists (
        select 1 from jsonb_array_elements(rooms) as r(value)
        where jsonb_typeof(r.value) <> 'string'
          or r.value #>> '{}' not in ('living','bedroom','kitchen','office','bathroom','other')
      ) then return false; end if;
    end if;
  end loop;
  return true;
end $$;
revoke all on function public.valid_furniture_specifications(jsonb) from public,anon,authenticated;
grant execute on function public.valid_furniture_specifications(jsonb) to service_role;

notify pgrst,'reload schema';
commit;
