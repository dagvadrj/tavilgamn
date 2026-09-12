create table if not exists public.kitchen_garnitures (
  user_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  design jsonb not null check (jsonb_typeof(design) = 'object' and octet_length(design::text) <= 250000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists kitchen_garnitures_owner_updated on public.kitchen_garnitures (user_id, updated_at desc);
alter table public.kitchen_garnitures enable row level security;
revoke all on public.kitchen_garnitures from anon;
grant select, insert, update, delete on public.kitchen_garnitures to authenticated;
grant all on public.kitchen_garnitures to service_role;
create policy kitchen_owner_select on public.kitchen_garnitures for select to authenticated using ((select auth.uid()) = user_id);
create policy kitchen_owner_insert on public.kitchen_garnitures for insert to authenticated with check ((select auth.uid()) = user_id);
create policy kitchen_owner_update on public.kitchen_garnitures for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy kitchen_owner_delete on public.kitchen_garnitures for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.touch_kitchen_garniture() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at = clock_timestamp();
  new.created_at = old.created_at;
  return new;
end;
$$;
revoke all on function public.touch_kitchen_garniture() from public;
create trigger kitchen_garnitures_updated before update on public.kitchen_garnitures
for each row execute function public.touch_kitchen_garniture();
