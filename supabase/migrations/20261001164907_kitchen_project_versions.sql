-- Additive: legacy writers still work, but all writes acquire version snapshots.
alter table public.kitchen_garnitures add column revision integer not null default 1 check (revision > 0);
create table public.kitchen_garniture_versions (
  user_id uuid not null,
  kitchen_id uuid not null,
  revision integer not null check (revision > 0),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  design jsonb not null check (jsonb_typeof(design) = 'object' and octet_length(design::text) <= 250000),
  thumbnail_url text,
  created_at timestamptz not null default clock_timestamp(),
  primary key (user_id, kitchen_id, revision),
  foreign key (user_id, kitchen_id) references public.kitchen_garnitures(user_id,id) on delete cascade
);
alter table public.kitchen_garniture_versions enable row level security;
revoke all on public.kitchen_garniture_versions from public, anon, authenticated;
grant select on public.kitchen_garniture_versions to authenticated;
grant all on public.kitchen_garniture_versions to service_role;
create policy kitchen_version_owner_read on public.kitchen_garniture_versions for select to authenticated
using ((select auth.uid()) = user_id);
insert into public.kitchen_garniture_versions(user_id,kitchen_id,revision,name,design,thumbnail_url,created_at)
select user_id,id,revision,name,design,thumbnail_url,updated_at from public.kitchen_garnitures;

create or replace function public.touch_kitchen_garniture() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.revision = 1;
  else
    if new.user_id <> old.user_id or new.id <> old.id then
      raise exception 'Kitchen ownership and identity are immutable' using errcode = '42501';
    end if;
    new.updated_at = clock_timestamp();
    new.created_at = old.created_at;
    new.revision = old.revision;
    if new.name is distinct from old.name or new.design is distinct from old.design then
      new.revision = old.revision + 1;
      -- Never attach the previous design's thumbnail to a new version.
      new.thumbnail_url = null;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.touch_kitchen_garniture() from public, anon, authenticated;
create trigger kitchen_garnitures_initial_revision before insert on public.kitchen_garnitures
for each row execute function public.touch_kitchen_garniture();

-- Only this non-exposed, non-callable trigger writes immutable snapshots.
create schema if not exists kitchen_private;
revoke all on schema kitchen_private from public, anon, authenticated;
create function kitchen_private.snapshot_project() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and auth.uid() <> new.user_id then
    raise exception 'Forbidden project snapshot' using errcode = '42501';
  end if;
  insert into public.kitchen_garniture_versions(user_id,kitchen_id,revision,name,design,thumbnail_url)
  values(new.user_id,new.id,new.revision,new.name,new.design,new.thumbnail_url)
  on conflict (user_id,kitchen_id,revision) do update set thumbnail_url = excluded.thumbnail_url;
  return new;
end;
$$;
revoke all on function kitchen_private.snapshot_project() from public, anon, authenticated;
create trigger kitchen_garnitures_snapshot after insert or update on public.kitchen_garnitures
for each row execute function kitchen_private.snapshot_project();

-- Service-only, server authenticates p_actor. Atomic CAS prevents stale-tab writes.
create function public.save_kitchen_project(p_actor uuid,p_id uuid,p_name text,p_design jsonb,p_expected_revision integer default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare project public.kitchen_garnitures;
begin
  if p_actor is null or p_id is null or (p_expected_revision is not null and p_expected_revision < 0) then
    raise exception 'Invalid project request' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor::text || ':' || p_id::text,0));
  select * into project from public.kitchen_garnitures where user_id = p_actor and id = p_id for update;
  if p_expected_revision is not null and p_expected_revision <> coalesce(project.revision,0) then
    raise exception 'Project revision conflict' using errcode = '40001';
  end if;
  insert into public.kitchen_garnitures(user_id,id,name,design) values(p_actor,p_id,p_name,p_design)
  on conflict (user_id,id) do update set name = excluded.name, design = excluded.design
  returning * into project;
  return to_jsonb(project);
end;
$$;
revoke all on function public.save_kitchen_project(uuid,uuid,text,jsonb,integer) from public, anon, authenticated;
grant execute on function public.save_kitchen_project(uuid,uuid,text,jsonb,integer) to service_role;
