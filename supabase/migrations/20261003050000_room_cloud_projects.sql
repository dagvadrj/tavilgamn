begin;
create table public.room_projects (
  user_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  document jsonb not null check (jsonb_typeof(document) = 'object' and document->>'schemaVersion' = '1'
    and jsonb_typeof(document->'design') = 'object' and octet_length(document::text) <= 1048576),
  revision integer not null check (revision > 0),
  room_count integer not null check (room_count between 1 and 12),
  piece_count integer not null check (piece_count between 0 and 500),
  import_key text check (char_length(import_key) between 1 and 160),
  archived_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id,id), unique (user_id,import_key)
);
create index room_projects_owner_page on public.room_projects(user_id,updated_at desc,id desc) where archived_at is null;
create table public.room_project_versions (
  user_id uuid not null, project_id uuid not null, revision integer not null check(revision > 0),
  operation_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  document jsonb not null check (jsonb_typeof(document) = 'object' and octet_length(document::text) <= 1048576),
  created_at timestamptz not null default clock_timestamp(),
  primary key (user_id,project_id,revision), unique(user_id,operation_id),
  foreign key (user_id,project_id) references public.room_projects(user_id,id) on delete cascade
);
alter table public.room_projects enable row level security;
alter table public.room_project_versions enable row level security;
revoke all on public.room_projects, public.room_project_versions from public,anon,authenticated,service_role;
grant select on public.room_projects, public.room_project_versions to authenticated,service_role;
create policy room_project_owner_read on public.room_projects for select to authenticated using ((select auth.uid()) = user_id);
create policy room_version_owner_read on public.room_project_versions for select to authenticated using ((select auth.uid()) = user_id);

-- Only the authenticated server calls this RPC. No direct browser/service write
-- grant exists: versions cannot be rewritten through a PostgREST table endpoint.
create function public.save_room_project(p_actor uuid,p_id uuid,p_name text,p_document jsonb,
  p_expected_revision integer,p_operation uuid,p_import_key text default null,p_force_version boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare project public.room_projects; version public.room_project_versions; rooms integer; pieces integer;
begin
  if p_actor is null or p_id is null or p_operation is null or p_expected_revision is null or p_expected_revision < 0
    or p_name is null or char_length(btrim(p_name)) not between 1 and 100
    or p_document is null or jsonb_typeof(p_document) <> 'object' or p_document->>'schemaVersion' is distinct from '1'
    or jsonb_typeof(p_document->'design'->'rooms') is distinct from 'array' or octet_length(p_document::text) > 1048576
    or (p_import_key is not null and char_length(p_import_key) not between 1 and 160) then
    raise exception 'Invalid room project' using errcode='22023';
  end if;
  if auth.uid() is not null and auth.uid() <> p_actor then raise exception 'Forbidden actor' using errcode='42501'; end if;
  rooms := jsonb_array_length(p_document->'design'->'rooms');
  select coalesce(sum(jsonb_array_length(r->'pieces')),0)::integer into pieces from jsonb_array_elements(p_document->'design'->'rooms') r;
  if rooms not between 1 and 12 or pieces not between 0 and 500 then raise exception 'Invalid room collections' using errcode='22023'; end if;
  -- One actor lock also serializes retries/import identities across project IDs.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('room:'||p_actor::text,0));
  select * into version from public.room_project_versions where user_id=p_actor and operation_id=p_operation;
  if found then
    if version.project_id<>p_id or version.name<>btrim(p_name) or version.document<>p_document then
      raise exception 'Operation key reused' using errcode='22023';
    end if;
    select * into project from public.room_projects where user_id=p_actor and id=p_id;
    return jsonb_build_object('project',to_jsonb(project)||jsonb_build_object('revision',version.revision,'name',version.name,
      'document',version.document,'updated_at',version.created_at),'alreadyImported',false);
  end if;
  if p_expected_revision=0 and p_import_key is not null then
    select * into project from public.room_projects where user_id=p_actor and import_key=p_import_key;
    if found then return jsonb_build_object('project',to_jsonb(project),'alreadyImported',true); end if;
  end if;
  select * into project from public.room_projects where user_id=p_actor and id=p_id for update;
  if p_expected_revision <> coalesce(project.revision,0) then raise exception 'Room revision conflict' using errcode='40001'; end if;
  if project.archived_at is not null then raise exception 'Room archived' using errcode='55000'; end if;
  if project.id is not null and project.name=btrim(p_name)
    and (project.document #- '{design,updatedAt}')=(p_document #- '{design,updatedAt}')
    and not coalesce(p_force_version,false) then
    return jsonb_build_object('project',to_jsonb(project),'alreadyImported',false);
  end if;
  insert into public.room_projects(user_id,id,name,document,revision,room_count,piece_count,import_key)
  values(p_actor,p_id,btrim(p_name),p_document,1,rooms,pieces,p_import_key)
  on conflict(user_id,id) do update set name=excluded.name,document=excluded.document,revision=room_projects.revision+1,
    room_count=excluded.room_count,piece_count=excluded.piece_count,updated_at=clock_timestamp()
  returning * into project;
  insert into public.room_project_versions(user_id,project_id,revision,operation_id,name,document)
  values(p_actor,p_id,project.revision,p_operation,project.name,project.document);
  return jsonb_build_object('project',to_jsonb(project),'alreadyImported',false);
end;
$$;
revoke all on function public.save_room_project(uuid,uuid,text,jsonb,integer,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.save_room_project(uuid,uuid,text,jsonb,integer,uuid,text,boolean) to service_role;

create function public.archive_room_project(p_actor uuid,p_id uuid,p_expected_revision integer,p_archived boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare project public.room_projects;
begin
  if p_actor is null or p_id is null or p_expected_revision is null or p_archived is null then raise exception 'Invalid room request' using errcode='22023'; end if;
  if auth.uid() is not null and auth.uid()<>p_actor then raise exception 'Forbidden actor' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('room:'||p_actor::text,0));
  select * into project from public.room_projects where user_id=p_actor and id=p_id for update;
  if not found then raise exception 'Room not found' using errcode='P0002'; end if;
  if project.revision<>p_expected_revision then raise exception 'Room revision conflict' using errcode='40001'; end if;
  update public.room_projects set archived_at=case when p_archived then coalesce(archived_at,clock_timestamp()) else null end,
    updated_at=clock_timestamp() where user_id=p_actor and id=p_id returning * into project;
  return to_jsonb(project);
end;
$$;
revoke all on function public.archive_room_project(uuid,uuid,integer,boolean) from public,anon,authenticated;
grant execute on function public.archive_room_project(uuid,uuid,integer,boolean) to service_role;

create function public.phase8_readiness() returns boolean language sql security invoker set search_path='' as $$
  select has_table_privilege(current_user,'public.room_projects','select')
    and has_table_privilege(current_user,'public.room_project_versions','select')
    and not has_table_privilege('authenticated','public.room_projects','insert')
    and not has_table_privilege('authenticated','public.room_project_versions','update')
    and not has_function_privilege('authenticated','public.save_room_project(uuid,uuid,text,jsonb,integer,uuid,text,boolean)','execute')
    and has_function_privilege(current_user,'public.save_room_project(uuid,uuid,text,jsonb,integer,uuid,text,boolean)','execute')
    and has_function_privilege(current_user,'public.archive_room_project(uuid,uuid,integer,boolean)','execute');
$$;
revoke all on function public.phase8_readiness() from public,anon,authenticated;
grant execute on function public.phase8_readiness() to service_role;
commit;
