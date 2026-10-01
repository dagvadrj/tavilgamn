-- Distinguish structurally different cabinets with the same opening/counts.
begin;
create or replace function public.enforce_cabinet_variant_code() returns trigger language plpgsql security invoker set search_path='' as $$
declare module public.kitchen_modules; model public.furniture_models; suffix text; design_code text;
begin
  select * into model from public.furniture_models where id=new.furniture_model_id for share;
  select * into module from public.kitchen_modules where id=new.module_id for share;
  if model.archived_at is not null or model.processing_status<>'ready' or model.glb_path is null then
    raise exception using errcode='22023',message='Ready kitchen GLB required'; end if;
  if model.cabinet_module_id is not null and model.cabinet_module_id<>new.module_id then
    raise exception using errcode='22023',message='Model belongs to a different module'; end if;
  suffix:=case new.opening
    when 'doors' then new.door_count||case when new.door_count=1 then '-DOOR' else '-DOORS' end
    when 'drawers' then case when new.door_count>0 then new.door_count||case when new.door_count=1 then '-DOOR-' else '-DOORS-' end else '' end
      ||new.drawer_count||case when new.drawer_count=1 then '-DRAWER' else '-DRAWERS' end
    else upper(new.opening) end;
  design_code:=coalesce(new.configuration->>'designCode','');
  if design_code<>'' then
    if design_code !~ '^[A-Z0-9]{1,16}(-[A-Z0-9]{1,16}){0,3}$' then
      raise exception using errcode='22023',message='Canonical design code required'; end if;
    suffix:=suffix||'-'||design_code;
  end if;
  if new.variant_code<>module.code||'-'||suffix or length(new.variant_code)>80 then
    raise exception using errcode='22023',message='Canonical variant code required'; end if;
  if new.opening='doors' and new.door_count not between 1 and 4 then raise exception using errcode='22023',message='Invalid door count'; end if;
  if abs(model.dimensions_w*1000-module.width_mm)>5 or abs(model.dimensions_h*1000-module.height_mm)>5 or abs(model.dimensions_d*1000-module.depth_mm)>5 then
    raise exception using errcode='22023',message='Model dimensions do not match module'; end if;
  update public.furniture_models set cabinet_module_id=new.module_id where id=model.id and cabinet_module_id is null;
  return new;
end $$;
revoke all on function public.enforce_cabinet_variant_code() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
