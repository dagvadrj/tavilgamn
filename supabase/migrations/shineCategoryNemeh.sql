alter table public.furniture_models
  drop constraint furniture_models_category_check;

alter table public.furniture_models
  add constraint furniture_models_category_check
  check (
    category in (
      'sofa',
      'wardrobe',
      'dining-table',
      'office',
      'bed',
      'tv-stand',
      'bookshelf',
      'kitchen-cabinet',
      'chair',
      'oven'
    )
  );