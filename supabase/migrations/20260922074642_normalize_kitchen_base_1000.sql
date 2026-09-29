begin;

insert into public.kitchen_modules(code,name,cabinet_type,width_mm,height_mm,depth_mm,active)
values('BASE-1000','1000мм доод шүүгээ','base',1000,820,600,true)
on conflict(code) do update set
  name=excluded.name,
  cabinet_type=excluded.cabinet_type,
  width_mm=excluded.width_mm,
  height_mm=excluded.height_mm,
  depth_mm=excluded.depth_mm,
  active=true;

-- A module with exactly one usable GLB should render that GLB without requiring
-- every planner user to select it manually first.
update public.kitchen_module_variants v
set is_default=true
where v.active
  and not exists (
    select 1 from public.kitchen_module_variants other
    where other.module_id=v.module_id and other.active and other.furniture_model_id<>v.furniture_model_id
  )
  and not exists (
    select 1 from public.kitchen_module_variants preferred
    where preferred.module_id=v.module_id and preferred.active and preferred.is_default
  );

commit;
