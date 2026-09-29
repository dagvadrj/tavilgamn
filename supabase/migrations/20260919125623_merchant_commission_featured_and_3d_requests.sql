alter table public.merchant_stores
  add column commission_bps integer not null default 500,
  add column is_featured boolean not null default false,
  add column featured_rank integer,
  add column featured_at timestamptz;

alter table public.merchant_stores
  add constraint merchant_stores_commission_bps_check
    check (commission_bps between 300 and 500),
  add constraint merchant_stores_featured_rank_check
    check (featured_rank is null or featured_rank >= 1);

create index merchant_stores_featured_idx
  on public.merchant_stores (is_featured desc, featured_rank asc, created_at asc)
  where active = true;

alter table public.furniture_models
  add column model_requested boolean not null default false,
  add column model_requested_at timestamptz,
  add column model_requested_by_store_id text references public.merchant_stores(id) on delete set null;

create index furniture_models_model_requested_idx
  on public.furniture_models (model_requested, processing_status, updated_at desc)
  where model_requested = true;

alter table public.merchant_order_fulfillments
  add column commission_bps integer not null default 500,
  add column platform_fee bigint
    generated always as ((subtotal * commission_bps::bigint) / 10000) stored,
  add column merchant_net bigint
    generated always as (subtotal - ((subtotal * commission_bps::bigint) / 10000)) stored;

alter table public.merchant_order_fulfillments
  add constraint merchant_order_fulfillments_commission_bps_check
    check (commission_bps between 300 and 500);

create index merchant_order_fulfillments_store_created_idx
  on public.merchant_order_fulfillments (store_id, created_at desc);
