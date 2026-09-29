-- Keep checkout ownership stable against concurrent merchant revocation.
begin;
create or replace function public.snapshot_merchant_order() returns trigger
language plpgsql security invoker set search_path='' as $$
declare line jsonb; stores jsonb; merchant public.merchant_stores;
begin
  for line in select value from jsonb_array_elements(new.items) loop
    -- reserve_order_stock already holds these product locks until commit.
    select store_ids into stores from public.furniture_models where product_id=line->>'productId';
    if not exists(select 1 from public.merchant_stores s where stores ? s.id) then continue; end if;
    if jsonb_typeof(stores) is distinct from 'array' or jsonb_array_length(stores)<>1 then
      raise exception using errcode='P0008',message='Ambiguous merchant ownership';
    end if;
    select s.* into merchant from public.merchant_stores s join public.profiles p on p.id=s.owner_id
      where s.id=stores->>0 and s.active and p.role='merchant' for share of p,s nowait;
    if not found then raise exception using errcode='P0008',message='Merchant unavailable'; end if;
  end loop;
  insert into public.merchant_order_fulfillments(order_id,store_id,owner_id,items,subtotal,created_at)
    select new.id,s.id,s.owner_id,jsonb_agg(x.line order by x.ordinal),sum((x.line->>'lineTotal')::bigint),new.created_at
    from jsonb_array_elements(new.items) with ordinality as x(line,ordinal)
    join public.furniture_models m on m.product_id=x.line->>'productId'
    join public.merchant_stores s on m.store_ids=jsonb_build_array(s.id)
    group by s.id,s.owner_id;
  return new;
exception when lock_not_available then
  -- Checkout already holds product locks. Do not wait on a profile/store lock
  -- held by an editor or role change that could itself be waiting on products.
  -- A retry starts a new transaction and revalidates ownership and inventory.
  raise exception using errcode='P0008',message='Merchant availability changed; retry checkout';
end $$;

commit;
