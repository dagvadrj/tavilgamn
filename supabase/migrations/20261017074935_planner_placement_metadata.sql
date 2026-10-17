-- Extend the existing specification contract without changing product IDs,
-- stock CAS, model ownership or the atomic save_furniture_product transaction.
begin;

create or replace function public.valid_furniture_specifications(value jsonb)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare item record; rooms jsonb; placement jsonb; support jsonb; field text;
begin
  if value is null or jsonb_typeof(value) <> 'object' then return false; end if;
  if (select count(*) from jsonb_each(value)) > 30 then return false; end if;
  for item in select * from jsonb_each(value) loop
    if item.key not in ('type','materialDetail','assembly','style','warranty','tiers','loadCapacity','doors','drawers','storage','seats','upholstery','seatHeight','shape','extendable','mattressSize','headboard','convertible','adjustment','firmness','thickness','filling','power','capacity','energyClass','plannerRoomTypes','plannerPlacement')
      or jsonb_typeof(item.value) <> 'string' or length(item.value #>> '{}') > 300 then return false; end if;
    if item.key = 'plannerPlacement' then
      begin
        placement := (item.value #>> '{}')::jsonb;
      exception when invalid_text_representation then return false;
      end;
      if jsonb_typeof(placement) is distinct from 'object' then return false; end if;
      if exists (select 1 from jsonb_object_keys(placement) k where k not in ('surfaces','defaultElevation','gap','supportSurfaces')) then return false; end if;
      if jsonb_typeof(placement->'surfaces') is distinct from 'array' then return false; end if;
      if jsonb_array_length(placement->'surfaces') not between 1 and 3 then return false; end if;
      if exists (select 1 from jsonb_array_elements(placement->'surfaces') s where jsonb_typeof(s) <> 'string' or s #>> '{}' not in ('floor','wall','surface')) then return false; end if;
      foreach field in array array['defaultElevation','gap'] loop
        if placement ? field then
          if jsonb_typeof(placement->field) is distinct from 'number' then return false; end if;
          if (placement->>field)::numeric < 0 or (placement->>field)::numeric > (case when field='gap' then 0.2 else 100 end) then return false; end if;
        end if;
      end loop;
      if placement ? 'supportSurfaces' then
        if jsonb_typeof(placement->'supportSurfaces') is distinct from 'array' then return false; end if;
        if jsonb_array_length(placement->'supportSurfaces') > 8 then return false; end if;
        for support in select * from jsonb_array_elements(placement->'supportSurfaces') loop
          if jsonb_typeof(support) is distinct from 'object' then return false; end if;
          if exists (select 1 from jsonb_object_keys(support) k where k not in ('id','width','depth','elevation')) then return false; end if;
          if jsonb_typeof(support->'id') is distinct from 'string' then return false; end if;
          if support->>'id' !~ '^[a-zA-Z0-9_-]{1,40}$' then return false; end if;
          foreach field in array array['width','depth','elevation'] loop
            if jsonb_typeof(support->field) is distinct from 'number' then return false; end if;
            if (support->>field)::numeric < 0 or (support->>field)::numeric > 100 or (field <> 'elevation' and (support->>field)::numeric = 0) then return false; end if;
          end loop;
        end loop;
        if exists (select 1 from jsonb_array_elements(placement->'supportSurfaces') s group by s->>'id' having count(*) > 1) then return false; end if;
      end if;
    end if;
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
