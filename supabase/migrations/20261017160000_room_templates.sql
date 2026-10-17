create table public.room_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 1 and 100),
  description text not null default '' check (length(description) <= 500),
  kind text not null check (kind in ('empty','furnished')),
  furnishing text not null default 'full' check (furnishing in ('full','partial')),
  room_type text not null check (room_type in ('living','bedroom','kitchen','office','bathroom','other')),
  area double precision not null check (area > 0 and area <= 6000),
  preview_image text not null default '' check (length(preview_image) <= 600000),
  design jsonb not null check (jsonb_typeof(design) = 'object' and octet_length(design::text) <= 2000000),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  sort_order integer not null default 0,
  version integer not null default 1 check (version > 0),
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'published' or length(preview_image) > 0)
);
create index room_templates_gallery on public.room_templates(status, sort_order, created_at);
alter table public.room_templates enable row level security;
revoke all on public.room_templates from anon, authenticated;
grant select on public.room_templates to anon, authenticated;
grant all on public.room_templates to service_role;
create policy room_templates_published on public.room_templates for select to anon, authenticated using (status = 'published');
-- Writes always pass through requireAdmin with a freshly verified profile role.
-- No client-side write policy and no destructive delete action in the admin UI.
