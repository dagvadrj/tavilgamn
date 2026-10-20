-- Preserve branch ownership when an admin changes a product's store, and free
-- archived inventory from branch availability without changing its total.
create index merchant_operation_events_actor_idx on public.merchant_operation_events(actor_id);
create function public.guard_branch_product() returns trigger
language plpgsql security invoker set search_path='' as $$
declare allocation record;
begin
  if new.store_ids is distinct from old.store_ids and exists(select 1 from public.merchant_branch_stock where product_id=old.product_id and quantity>0) then
    raise exception using errcode='22023',message='Reallocate branch inventory before changing product store';
  end if;
  if old.archived_at is null and new.archived_at is not null then
    for allocation in select bs.*,b.store_id from public.merchant_branch_stock bs join public.merchant_branches b on b.id=bs.branch_id
      where product_id=old.product_id and quantity>0 order by bs.branch_id for update of bs loop
      update public.merchant_branch_stock set quantity=0,updated_at=now() where branch_id=allocation.branch_id and product_id=old.product_id;
      insert into public.merchant_operation_events(store_id,action,details) values(allocation.store_id,'archived_stock_released',jsonb_build_object('productId',old.product_id,'branchId',allocation.branch_id,'quantity',allocation.quantity));
    end loop;
  end if;
  return new;
end $$;
create trigger guard_branch_product before update of store_ids,archived_at on public.furniture_models for each row execute function public.guard_branch_product();
revoke all on function public.guard_branch_product() from public,anon,authenticated;
grant execute on function public.guard_branch_product() to service_role;
-- A zero allocation carries no useful availability and need not expose an old
-- branch ID after a legitimate store transfer. Existing sums remain unchanged.
create or replace function public.read_branch_allocations(p_product text,p_store text) returns jsonb
language sql security invoker set search_path='' as $$
  select coalesce(jsonb_object_agg(bs.branch_id,bs.quantity),'{}'::jsonb) from public.merchant_branch_stock bs join public.merchant_branches b on b.id=bs.branch_id
  where bs.product_id=p_product and b.store_id=p_store and bs.quantity>0
$$;
revoke all on function public.read_branch_allocations(text,text) from public,anon,authenticated;
grant execute on function public.read_branch_allocations(text,text) to service_role;
do $$
declare definition text; original text:='coalesce((select jsonb_object_agg(branch_id,quantity) from public.merchant_branch_stock where product_id=f.product_id),''{}'')';
begin
  definition:=pg_get_functiondef('public.merchant_operations(uuid,text,jsonb)'::regprocedure);
  if position(original in definition)=0 then raise exception 'Branch allocation reader changed; review migration'; end if;
  execute replace(definition,original,'public.read_branch_allocations(f.product_id,sid)');
end $$;
