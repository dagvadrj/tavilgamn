-- Merchant-owned furnished rooms (C1–C3). A store owns its rooms; rows without
-- a store remain the platform's starter templates.
--
-- The main columns always hold what shoppers see once a room is published.
-- Editing a published room writes `draft` instead, so the gallery keeps the
-- published version until the merchant publishes again. `version` stays the
-- optimistic-concurrency token and also numbers the saved versions.
alter table public.room_templates
  add column store_id text references public.merchant_stores(id) on delete set null,
  add column published_version integer check (published_version > 0),
  add column draft jsonb check (
    draft is null or (jsonb_typeof(draft) = 'object' and octet_length(draft::text) <= 2700000)
  ),
  add column draft_version integer check (draft_version > 0),
  add column piece_count integer not null default 0 check (piece_count between 0 and 300),
  add column width double precision check (width is null or (width > 0 and width <= 100)),
  add column depth double precision check (depth is null or (depth > 0 and depth <= 100));

update public.room_templates t set
  published_version = case when t.status = 'published' then t.version end,
  piece_count = coalesce((
    select sum(jsonb_array_length(coalesce(r -> 'pieces', '[]'::jsonb)))
    from jsonb_array_elements(coalesce(t.design -> 'rooms', '[]'::jsonb)) r
  ), jsonb_array_length(coalesce(t.design -> 'pieces', '[]'::jsonb)), 0),
  width = nullif(t.design ->> 'width', '')::double precision,
  depth = nullif(t.design ->> 'depth', '')::double precision;

create index room_templates_store on public.room_templates(store_id, updated_at desc);
create index room_templates_public_gallery on public.room_templates(status, store_id, room_type, furnishing, sort_order);

-- Drafts never reach the public select policy; the API also omits the column.
revoke select on public.room_templates from anon, authenticated;
grant select (id, title, description, kind, furnishing, room_type, area, preview_image, design,
  status, sort_order, version, published_version, store_id, piece_count, width, depth,
  created_at, updated_at) on public.room_templates to anon, authenticated;
-- Merchant writes pass through the API with a freshly verified merchant store.
