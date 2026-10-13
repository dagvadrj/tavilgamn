-- Hide an image from an editable gallery while retaining render/audit references.
create function public.remove_kitchen_design_media(
  p_actor uuid, p_design uuid, p_version uuid, p_media uuid
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  target public.kitchen_design_media;
  replacement uuid;
begin
  perform set_config('app.kitchen_actor',p_actor::text,true);
  perform 1 from public.profiles where id=p_actor and role='merchant' for share;
  if not found then raise exception using errcode='42501',message='Merchant required'; end if;

  perform 1 from public.kitchen_designs d
    join public.merchant_stores s on s.id=d.store_id
    join public.kitchen_design_versions v on v.design_id=d.id
    where d.id=p_design and v.id=p_version and d.created_by=p_actor
      and s.owner_id=p_actor and s.active and s.store_type in ('factory','handmade')
      and d.publication_status not in ('archived','suspended')
      and v.review_status in ('draft','changes_requested')
    for update of d,v;
  if not found then raise exception using errcode='42501',message='Editable kitchen version required'; end if;

  select * into target from public.kitchen_design_media
    where id=p_media and version_id=p_version and status='ready' for update;
  if not found then raise exception using errcode='P0002',message='Gallery image not found'; end if;
  if exists(select 1 from public.kitchen_render_jobs
    where version_id=p_version and status in ('queued','processing') and input_image_url=target.url) then
    raise exception using errcode='P0020',message='Active render source cannot be removed';
  end if;

  update public.kitchen_design_media set status='rejected',is_primary=false,
    metadata=metadata||jsonb_build_object('removedByMerchant',p_actor,'removedAt',now())
    where id=p_media;
  if target.is_primary then
    select id into replacement from public.kitchen_design_media
      where version_id=p_version and status='ready' and kind='thumbnail'
      order by created_at desc,id desc limit 1 for update;
    if replacement is not null then
      update public.kitchen_design_media set is_primary=true where id=replacement;
    end if;
  end if;
  return jsonb_build_object('id',p_media,'replacementMediaId',replacement);
end;
$$;

revoke all on function public.remove_kitchen_design_media(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.remove_kitchen_design_media(uuid,uuid,uuid,uuid) to service_role;
notify pgrst, 'reload schema';
