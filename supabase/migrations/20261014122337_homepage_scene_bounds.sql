-- cardinality() also rejects empty arrays, for which array_length() is NULL.
alter table public.homepage_scene_settings
  add constraint homepage_scene_exactly_two check (cardinality(product_ids) = 2);
revoke delete, truncate, references, trigger on public.homepage_scene_settings from service_role;
