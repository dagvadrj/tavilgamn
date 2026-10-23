-- Each new agreement belongs to one store; legacy signed text stays immutable.
alter table public.merchant_contract_versions
  add column store_id text references public.merchant_stores(id),
  add column file_path text,
  add column file_name text,
  add column file_type text,
  add column file_size integer,
  add column file_sha256 text,
  alter column body set default '';
alter table public.merchant_contract_versions drop constraint merchant_contract_versions_body_check;
alter table public.merchant_contract_versions add constraint merchant_contract_body_length check(length(body)<=100000);
alter table public.merchant_contract_versions add constraint merchant_contract_file_complete check(
  (file_path is null and file_name is null and file_type is null and file_size is null and file_sha256 is null) or
  (file_path is not null and file_name is not null and file_type is not null and file_size is not null and file_sha256 is not null
    and file_path ~ '^contracts/[a-f0-9-]{36}/[a-f0-9-]{36}\.(pdf|docx)$'
    and length(file_name) between 1 and 255
    and file_type in ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    and file_size between 1 and 10485760 and file_sha256 ~ '^[a-f0-9]{64}$')
);
alter table public.merchant_contract_versions add constraint merchant_contract_store_file check(store_id is null or file_path is not null);
drop index public.merchant_contract_single_draft;
create unique index merchant_contract_store_draft on public.merchant_contract_versions(store_id) where status='draft' and store_id is not null;
create unique index merchant_contract_legacy_draft on public.merchant_contract_versions(status) where status='draft' and store_id is null;
create index merchant_contract_store_versions on public.merchant_contract_versions(store_id,version_no desc);
create unique index merchant_contract_file_path on public.merchant_contract_versions(file_path) where file_path is not null;

-- No client storage policies: files are served only after the server checks scope.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('merchant-contracts','merchant-contracts',false,10485760,
  array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict(id) do nothing;

create or replace function public.admin_merchant_contracts(p_actor uuid,p_action text default 'read',p_data jsonb default '{}')
returns jsonb language plpgsql set search_path='' as $$
declare target public.merchant_contract_versions; sid text:=nullif(p_data->>'storeId',''); page_no integer; attachment jsonb;
begin
  perform 1 from public.profiles where id=p_actor and role='admin' for share;
  if not found then raise exception using errcode='42501',message='Admin required'; end if;
  if sid is not null then
    perform 1 from public.merchant_stores where id=sid for share;
    if not found then raise exception using errcode='22023',message='Store not found'; end if;
  end if;
  page_no:=coalesce((p_data->>'page')::integer,0);
  if page_no<0 or page_no>100000 then raise exception using errcode='22023',message='Invalid page'; end if;
  if p_action='file' then
    select * into target from public.merchant_contract_versions where id=(p_data->>'id')::uuid and store_id=sid;
    if not found then raise exception using errcode='42501',message='Contract not accessible'; end if;
    return jsonb_build_object('contract',to_jsonb(target));
  end if;
  if p_action in ('save','publish') then
    if sid is null then raise exception using errcode='22023',message='Select a merchant'; end if;
    perform 1 from public.merchant_stores s join public.profiles p on p.id=s.owner_id
      where s.id=sid and s.active and p.role='merchant' for share of s,p;
    if not found then raise exception using errcode='42501',message='Active merchant required'; end if;
    perform pg_advisory_xact_lock(721661);
    if p_action='save' then
      select * into target from public.merchant_contract_versions where store_id=sid and status='draft' for update;
      if (target.id is null and nullif(p_data->>'id','') is not null) or
        (target.id is not null and (target.id::text is distinct from p_data->>'id' or target.revision is distinct from (p_data->>'revision')::integer)) then
        raise exception using errcode='P0003',message='Draft changed'; end if;
      if length(trim(coalesce(p_data->>'title',''))) not between 1 and 200 or
        length(trim(coalesce(p_data->>'platformName',''))) not between 1 and 300 then
        raise exception using errcode='22023',message='Complete contract required'; end if;
      attachment:=p_data->'file';
      if attachment is null or attachment='null'::jsonb then
        if target.file_path is null then raise exception using errcode='22023',message='Contract file required'; end if;
        attachment:=jsonb_build_object('path',target.file_path,'name',target.file_name,'type',target.file_type,'size',target.file_size,'sha256',target.file_sha256);
      end if;
      if target.id is null then
        insert into public.merchant_contract_versions(store_id,title,platform_name,body,created_by,file_path,file_name,file_type,file_size,file_sha256)
        values(sid,trim(p_data->>'title'),trim(p_data->>'platformName'),'',p_actor,attachment->>'path',attachment->>'name',attachment->>'type',(attachment->>'size')::integer,attachment->>'sha256') returning * into target;
      else
        update public.merchant_contract_versions set title=trim(p_data->>'title'),platform_name=trim(p_data->>'platformName'),
          file_path=attachment->>'path',file_name=attachment->>'name',file_type=attachment->>'type',file_size=(attachment->>'size')::integer,file_sha256=attachment->>'sha256',revision=revision+1
          where id=target.id returning * into target;
      end if;
    else
      select * into target from public.merchant_contract_versions where id=(p_data->>'id')::uuid and store_id=sid and status='draft' for update;
      if not found or target.revision is distinct from (p_data->>'revision')::integer then
        raise exception using errcode='P0003',message='Draft changed'; end if;
      if target.file_path is null then raise exception using errcode='22023',message='Contract file required'; end if;
      update public.merchant_contract_versions set status='published',published_at=now(),revision=revision+1 where id=target.id;
    end if;
  elsif p_action<>'read' then raise exception using errcode='22023',message='Unknown operation'; end if;
  return jsonb_build_object('storeId',sid,
    'merchants',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'active',active) order by name,id) from public.merchant_stores),'[]'),
    'versions',coalesce((select jsonb_agg(to_jsonb(x) order by version_no desc) from (
      select * from public.merchant_contract_versions where store_id=sid order by version_no desc limit 30) x),'[]'),
    'acceptances',coalesce((select jsonb_agg(to_jsonb(x) order by accepted_at desc,id) from (
      select a.id,a.contract_id,a.store_id,a.signer_name,a.accepted_at,a.store_snapshot,a.commission_bps,v.version_no
      from public.merchant_contract_acceptances a join public.merchant_contract_versions v on v.id=a.contract_id
      where a.store_id=sid order by a.accepted_at desc,a.id limit 51 offset page_no*50) x),'[]'));
end $$;

create or replace function public.merchant_contracts(p_actor uuid,p_action text default 'read',p_data jsonb default '{}')
returns jsonb language plpgsql set search_path='' as $$
declare s public.merchant_stores; target public.merchant_contract_versions;
begin
  perform 1 from public.profiles where id=p_actor and role='merchant' for share;
  if not found then raise exception using errcode='42501',message='Merchant required'; end if;
  select * into s from public.merchant_stores where owner_id=p_actor and active for share;
  if not found then raise exception using errcode='42501',message='Active store required'; end if;
  perform pg_advisory_xact_lock(721661);
  select * into target from public.merchant_contract_versions where store_id=s.id and status='published' order by version_no desc limit 1;
  if p_action='accept' then
    if target.id is null or target.id::text is distinct from p_data->>'contractId' then
      raise exception using errcode='P0003',message='Contract changed'; end if;
    if (p_data->>'consent') is distinct from 'true' or length(trim(coalesce(p_data->>'signerName',''))) not between 2 and 200 then
      raise exception using errcode='22023',message='Name and explicit consent required'; end if;
    insert into public.merchant_contract_acceptances(contract_id,store_id,accepted_by,signer_name,store_snapshot,commission_bps)
      values(target.id,s.id,p_actor,trim(p_data->>'signerName'),jsonb_build_object('name',s.name,'address',s.address,
        'phone',s.phone,'legalName',(select legal_name from public.merchant_growth_profiles where store_id=s.id)),s.commission_bps)
      on conflict(store_id,contract_id) do nothing;
  elsif p_action<>'read' then raise exception using errcode='22023',message='Unknown operation'; end if;
  return jsonb_build_object('current',case when target.id is null then null else to_jsonb(target) end,
    'acceptances',coalesce((select jsonb_agg(jsonb_build_object('acceptance',to_jsonb(a),'contract',to_jsonb(v)) order by a.accepted_at desc)
      from public.merchant_contract_acceptances a join public.merchant_contract_versions v on v.id=a.contract_id
      where a.store_id=s.id and (v.store_id=s.id or v.store_id is null)),'[]'));
end $$;
revoke all on function public.admin_merchant_contracts(uuid,text,jsonb),public.merchant_contracts(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.admin_merchant_contracts(uuid,text,jsonb),public.merchant_contracts(uuid,text,jsonb) to service_role;
