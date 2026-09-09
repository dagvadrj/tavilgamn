begin;
create table public.order_payments (
  order_id uuid primary key references public.orders(id),
  method text not null check (method in ('qpay', 'socialpay', 'bank_transfer')),
  state text not null default 'creating' check (state in ('creating', 'ready', 'needs_review', 'paid')),
  callback_token text not null,
  invoice_id text,
  instructions jsonb,
  provider_reference text,
  verified_by uuid references auth.users(id),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique(method, provider_reference)
);
alter table public.order_payments enable row level security;
revoke all on public.order_payments from anon, authenticated;
grant all on public.order_payments to service_role;

-- Atomically record verification and update the matching pending order.
create function public.confirm_order_payment(p_order_id uuid, p_method text, p_reference text,
  p_amount bigint, p_verified_by uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare payment public.order_payments; target public.orders;
begin
  select * into payment from public.order_payments where order_id = p_order_id for update;
  if not found or payment.method <> p_method then raise exception 'Payment method mismatch'; end if;
  select * into target from public.orders where id = p_order_id for update;
  if not found or target.total <> p_amount or target.currency <> 'MNT' then raise exception 'Payment amount mismatch'; end if;
  if payment.state = 'paid' then
    if payment.provider_reference <> p_reference then raise exception 'Payment reference mismatch'; end if;
    return;
  end if;
  if target.status <> 'pending_payment' then raise exception 'Order is not payable'; end if;
  if p_reference is null or length(trim(p_reference)) = 0 then raise exception 'Missing payment reference'; end if;
  if p_method = 'bank_transfer' and p_verified_by is null then raise exception 'Admin verification required'; end if;
  update public.order_payments set state = 'paid', provider_reference = p_reference,
    paid_at = now(), verified_by = p_verified_by where order_id = p_order_id;
  update public.orders set status = 'paid' where id = p_order_id;
end;
$$;
revoke all on function public.confirm_order_payment(uuid,text,text,bigint,uuid) from public, anon, authenticated;
grant execute on function public.confirm_order_payment(uuid,text,text,bigint,uuid) to service_role;
commit;
