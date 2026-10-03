begin;
-- Room history may reference imported kitchen/extras assets. Archiving a project
-- does not make its immutable versions eligible for provider object deletion.
create or replace function public.storage_cleanup_candidates(p_limit integer default 100)
returns table(kind text,id uuid,storage_key text)
language sql security invoker set search_path='' as $$
  select c.kind,c.id,c.storage_key from (
    select 'model'::text kind,a.id,a.storage_path storage_key,a.created_at
    from public.model_assets a
    where a.role='source' and a.storage_path like 'r2://%/models/%/source/%.glb'
      and ((a.state='pending' and a.updated_at<now()-interval '7 days')
        or (a.state='deleting' and (a.cleanup_claimed_at is null or a.cleanup_claimed_at<now()-interval '1 hour')))
      and not exists(select 1 from public.furniture_models m where a.storage_path in
        (m.source_glb_path,m.glb_path,m.preview_glb_path,m.standard_glb_path,m.thumbnail_path))
      and not exists(select 1 from public.room_project_versions v where position(a.storage_path in v.document::text)>0)
    union all
    select 'image'::text,a.id,a.public_id,a.created_at
    from public.product_media_assets a
    where a.public_id ~ '^casa-nova/products/[0-9a-f-]{36}/[0-9a-f-]{36}$'
      and ((a.state in ('uploading','failed') and a.created_at<now()-interval '7 days')
        or (a.state='deleting' and (a.cleanup_claimed_at is null or a.cleanup_claimed_at<now()-interval '1 hour')))
      and not exists(select 1 from public.product_media_refs r where r.asset_id=a.id)
      and (a.url is null or (
        not exists(select 1 from public.furniture_models m where m.image_url=a.url or m.images ? a.url)
        and not exists(select 1 from public.kitchen_design_media m where m.url=a.url)
        and not exists(select 1 from public.kitchen_render_jobs j where j.input_image_url=a.url)
        and not exists(select 1 from public.orders o where position(a.url in o.items::text)>0)
        and not exists(select 1 from public.room_project_versions v where position(a.url in v.document::text)>0)))
  ) c order by c.created_at,c.id limit greatest(1,least(coalesce(p_limit,100),100));
$$;
revoke all on function public.storage_cleanup_candidates(integer) from public,anon,authenticated;
grant execute on function public.storage_cleanup_candidates(integer) to service_role;
commit;
