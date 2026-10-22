-- LIKE INCLUDING ALL does not copy foreign keys. Keep the existing store link semantics.
alter table public.kitchen_models
  add constraint kitchen_models_requested_by_store_fk
  foreign key(model_requested_by_store_id) references public.merchant_stores(id) on delete set null;
