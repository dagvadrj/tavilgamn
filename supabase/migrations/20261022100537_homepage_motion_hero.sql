-- Additive: preserve existing scene choices and the singleton's server-only RLS.
alter table public.homepage_scene_settings
  add column hero jsonb;
alter table public.homepage_scene_settings
  add constraint homepage_hero_object check (hero is null or jsonb_typeof(hero) = 'object');
comment on column public.homepage_scene_settings.hero is 'Admin-managed marketing hero; text and safe destinations are validated by the admin API.';
