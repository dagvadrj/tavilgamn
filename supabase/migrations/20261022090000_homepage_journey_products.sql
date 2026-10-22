-- Optional journey slots; retain the existing two-sofa selection and its bounds.
alter table public.homepage_scene_settings
  add column if not exists bed_product_id uuid,
  add column if not exists wardrobe_product_id uuid;
comment on column public.homepage_scene_settings.bed_product_id is 'Optional public modeled bed for the bedroom journey. Null uses an available modeled bed or the interior demonstration asset.';
comment on column public.homepage_scene_settings.wardrobe_product_id is 'Optional public modeled wardrobe for the bedroom journey. Null uses an available modeled wardrobe or the interior demonstration asset.';
