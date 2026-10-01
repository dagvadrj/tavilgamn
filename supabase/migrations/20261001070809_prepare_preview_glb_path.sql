-- Expand first: keep the deployed site compatible until the new code is live.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.furniture_models
  add column if not exists preview_glb_path text;

update public.furniture_models
set preview_glb_path = low_glb_path
where preview_glb_path is null and low_glb_path is not null;

commit;
