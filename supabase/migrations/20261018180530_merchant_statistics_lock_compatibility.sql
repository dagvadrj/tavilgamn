-- Both statistics functions call merchant_delivery_store(), whose role/store
-- SELECT FOR SHARE locks prevent concurrent ownership changes. PostgREST runs
-- STABLE RPCs inside READ ONLY transactions even on POST, rejecting those locks
-- with SQLSTATE 25006. Keep the ownership locks and use the default VOLATILE
-- contract of the other merchant read RPCs. No data, grants or RLS are changed.
alter function public.merchant_dashboard_progress(uuid,date,integer) volatile;
alter function public.merchant_dashboard_trends(uuid) volatile;
notify pgrst, 'reload schema';
