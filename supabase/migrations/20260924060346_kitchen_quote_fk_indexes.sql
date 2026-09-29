create index kitchen_quotes_store_idx
  on public.kitchen_quote_requests(store_id);
create index kitchen_quotes_design_version_idx
  on public.kitchen_quote_requests(design_id,version_id);
create index kitchen_quotes_customer_project_idx
  on public.kitchen_quote_requests(customer_id,project_id)
  where project_id is not null;
