create table public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('kitchen_review')),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  body text not null default '' check (char_length(body)<=1000),
  href text not null check (char_length(href) between 1 and 500 and href like '/%'),
  entity_id uuid,
  source_key text not null unique check (char_length(source_key) between 8 and 200),
  metadata jsonb not null default '{}' check (jsonb_typeof(metadata)='object' and octet_length(metadata::text)<=10000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index user_notifications_owner_created_idx on public.user_notifications(user_id,created_at desc,id);
create index user_notifications_owner_unread_idx on public.user_notifications(user_id,created_at desc,id) where read_at is null;

alter table public.user_notifications enable row level security;
revoke all on public.user_notifications from public,anon,authenticated;
grant all on public.user_notifications to service_role;
create policy user_notifications_private on public.user_notifications for all to anon,authenticated using(false) with check(false);

create or replace function public.review_kitchen_design(p_actor uuid,p_design uuid,p_version uuid,p_action text,p_note text default '')
returns void language plpgsql security invoker set search_path='' as $$
declare target_owner uuid; review_id uuid; notification_title text; notification_body text;
begin
  perform 1 from public.profiles where id=p_actor and role='admin' for share;
  if not found then raise exception using errcode='42501',message='Admin required'; end if;
  if p_action not in ('approved','changes_requested','rejected','unpublished') then
    raise exception using errcode='22023',message='Invalid review action';
  end if;
  if p_action='unpublished' then
    select created_by into target_owner from public.kitchen_designs
      where id=p_design and publication_status='published' for update;
    if not found then raise exception using errcode='P0002',message='Published kitchen design not found'; end if;
    update public.kitchen_designs set publication_status='suspended' where id=p_design;
    notification_title:='Гал тогооны загварыг marketplace-с буулгалаа';
    notification_body:=coalesce(nullif(btrim(p_note),''),'Дэлгэрэнгүй мэдээллийг admin-аас авна уу.');
  else
    select d.created_by into target_owner
    from public.kitchen_design_versions v join public.kitchen_designs d on d.id=v.design_id
    where v.id=p_version and v.design_id=p_design and v.review_status='submitted' for update of v;
    if not found then raise exception using errcode='P0002',message='Submitted kitchen version not found'; end if;
    update public.kitchen_design_versions set review_status=p_action,
      approved_at=case when p_action='approved' then now() else null end where id=p_version;
    notification_title:=case p_action
      when 'approved' then 'Гал тогооны загвар зөвшөөрөгдлөө'
      when 'changes_requested' then 'Гал тогооны загварт засвар хүссэн'
      else 'Гал тогооны загвар татгалзсан'
    end;
    notification_body:=coalesce(nullif(btrim(p_note),''),case p_action
      when 'approved' then 'Загвараа marketplace-д нийтлэх боломжтой боллоо.'
      when 'changes_requested' then 'Засварын дэлгэрэнгүйг загварын review timeline-аас харна уу.'
      else 'Шинэ version бэлдэж дахин хяналтад илгээж болно.'
    end);
  end if;
  insert into public.kitchen_design_reviews(design_id,version_id,reviewer_id,action,note)
    values(p_design,case when p_action='unpublished' then null else p_version end,p_actor,p_action,coalesce(p_note,''))
    returning id into review_id;
  insert into public.user_notifications(user_id,kind,title,body,href,entity_id,source_key,metadata)
    values(target_owner,'kitchen_review',notification_title,left(notification_body,1000),
      '/merchant?tab=kitchens&design='||p_design,p_design,'kitchen-review:'||review_id,
      jsonb_build_object('reviewId',review_id,'designId',p_design,'versionId',case when p_action='unpublished' then null else p_version end,'action',p_action));
end;
$$;

revoke all on function public.review_kitchen_design(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.review_kitchen_design(uuid,uuid,uuid,text,text) to service_role;

notify pgrst,'reload schema';
