alter table public.kitchen_garnitures
  add column if not exists thumbnail_url text
  check (thumbnail_url is null or (char_length(thumbnail_url) between 8 and 2000 and thumbnail_url ~ '^https://'));

create function public.copy_kitchen_project_thumbnail_to_marketplace() returns trigger
language plpgsql security invoker set search_path='' as $$
declare project_thumbnail text; project_name text;
begin
  if new.version_no <> 1 then return new; end if;
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
revoke all on function public.copy_kitchen_project_thumbnail_to_marketplace() from public,anon,authenticated;
grant execute on function public.copy_kitchen_project_thumbnail_to_marketplace() to service_role;

create trigger kitchen_design_version_copy_project_thumbnail
after insert on public.kitchen_design_versions
for each row execute function public.copy_kitchen_project_thumbnail_to_marketplace();
