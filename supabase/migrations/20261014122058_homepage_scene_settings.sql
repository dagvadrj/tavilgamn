-- Only the server may access this singleton. Admin routes verify identity and role.
create table public.homepage_scene_settings (
  id smallint primary key default 1 check (id = 1),
  product_ids uuid[] not null check (
    array_ndims(product_ids) = 1 and array_length(product_ids, 1) = 2
    and array_lower(product_ids, 1) = 1 and array_position(product_ids, null) is null
    and product_ids[1] <> product_ids[2]
  ),
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
alter table public.homepage_scene_settings enable row level security;
revoke all on public.homepage_scene_settings from public, anon, authenticated;
grant select, insert, update on public.homepage_scene_settings to service_role;
comment on table public.homepage_scene_settings is 'Homepage sofa selection. Public presentation is exposed through the page-data API; only verified admins may update it.';
