-- The auth trigger invokes this function internally. Browser roles never need
-- to call the SECURITY DEFINER function through the Data API.
revoke execute on function public.handle_new_user()
  from public, anon, authenticated;
grant execute on function public.handle_new_user()
  to service_role;

-- Cover the order_payments foreign key used when an auth user is removed or
-- its key is updated. The partial index stays small because most rows are
-- verified by the payment provider rather than an administrator.
create index if not exists order_payments_verified_by_idx
  on public.order_payments (verified_by)
  where verified_by is not null;
