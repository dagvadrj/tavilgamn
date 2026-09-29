alter table public.kitchen_garnitures
  add column source_marketplace_design_id uuid,
  add column source_marketplace_version_id uuid,
  add constraint kitchen_garnitures_marketplace_source_fkey
    foreign key(source_marketplace_design_id,source_marketplace_version_id)
    references public.kitchen_design_versions(design_id,id)
    match full on delete set null;

create index kitchen_garnitures_marketplace_source_idx
  on public.kitchen_garnitures(source_marketplace_design_id,source_marketplace_version_id)
  where source_marketplace_design_id is not null;

create function public.protect_kitchen_marketplace_source() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if current_user not in ('service_role','postgres') and (
    (tg_op='INSERT' and new.source_marketplace_design_id is not null) or
    (tg_op='UPDATE' and (
      new.source_marketplace_design_id is distinct from old.source_marketplace_design_id or
      new.source_marketplace_version_id is distinct from old.source_marketplace_version_id
    ))
  ) then
    raise exception using errcode='42501',message='Marketplace source is server managed';
  end if;
  return new;
end;
$$;
revoke all on function public.protect_kitchen_marketplace_source()
  from public,anon,authenticated;
grant execute on function public.protect_kitchen_marketplace_source()
  to service_role;
create trigger kitchen_garnitures_protect_marketplace_source
before insert or update on public.kitchen_garnitures
for each row execute function public.protect_kitchen_marketplace_source();

create function public.clone_published_kitchen_design(
  p_actor uuid,p_design uuid,p_project uuid
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare source_version uuid; project_data jsonb; project_title text; project_thumbnail text;
  saved_project public.kitchen_garnitures;
begin
  perform 1 from auth.users where id=p_actor for share;
  if not found then raise exception using errcode='42501',message='Authenticated user required'; end if;

  select v.id,v.design,v.title,(
    select m.url from public.kitchen_design_media m
    where m.version_id=v.id and m.kind='thumbnail' and m.is_primary and m.status='ready'
    order by m.sort_order,m.id limit 1
  ) into source_version,project_data,project_title,project_thumbnail
  from public.kitchen_designs d
  join public.kitchen_design_versions v
    on v.design_id=d.id and v.id=d.published_version_id
  where d.id=p_design and d.publication_status='published' and v.review_status='approved'
  for share of d,v;
  if not found then raise exception using errcode='P0002',message='Published kitchen design not found'; end if;

  if jsonb_typeof(project_data) is distinct from 'object'
    or jsonb_typeof(project_data->'cabinets') is distinct from 'array'
    or jsonb_array_length(project_data->'cabinets') not between 1 and 80 then
    raise exception using errcode='P0014',message='Published kitchen snapshot is invalid';
  end if;

  insert into public.kitchen_garnitures(
    user_id,id,name,design,thumbnail_url,source_marketplace_design_id,source_marketplace_version_id
  ) values(
    p_actor,p_project,left(project_title,90)||' (хуулбар)',project_data,project_thumbnail,p_design,source_version
  ) on conflict(user_id,id) do nothing;

  select * into saved_project from public.kitchen_garnitures
  where user_id=p_actor and id=p_project;
  if not found or saved_project.source_marketplace_design_id is distinct from p_design
    or saved_project.source_marketplace_version_id is distinct from source_version then
    raise exception using errcode='P0013',message='Kitchen project id conflict';
  end if;

  return jsonb_build_object(
    'id',saved_project.id,'name',saved_project.name,'design',saved_project.design,
    'thumbnail_url',saved_project.thumbnail_url,'created_at',saved_project.created_at,
    'updated_at',saved_project.updated_at
  );
end;
$$;

revoke all on function public.clone_published_kitchen_design(uuid,uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.clone_published_kitchen_design(uuid,uuid,uuid)
  to service_role;

notify pgrst,'reload schema';
