-- Apply in the connected Supabase project's SQL editor or migration runner.
-- Existing auth users, profiles and furniture_models tables remain unchanged.
begin;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  idempotency_key uuid not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'paid', 'processing', 'shipped', 'delivered', 'cancelled')),
  currency text not null default 'MNT' check (currency = 'MNT'),
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 100),
  delivery jsonb not null check (
    jsonb_typeof(delivery) = 'object' and delivery ?& array['name', 'phone', 'address']
  ),
  subtotal bigint not null check (subtotal >= 0),
  shipping bigint not null check (shipping >= 0),
  total bigint not null check (total >= 0 and total = subtotal + shipping and total <= 9007199254740991),
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create index orders_user_created_idx on public.orders (user_id, created_at desc, id desc);
create index orders_created_idx on public.orders (created_at desc, id desc);

alter table public.orders enable row level security;
revoke all on public.orders from anon, authenticated;
grant select on public.orders to authenticated;
grant all on public.orders to service_role;

create policy orders_read_own on public.orders for select to authenticated
  using ((select auth.uid()) = user_id);

-- Writes go through the server, which verifies the token and calculates prices.
-- No client INSERT/UPDATE/DELETE policy; payment status cannot be set by a browser.
commit;
