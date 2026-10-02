begin;

-- API identity is verified through Auth.getUser before invoking these service-only
-- functions. profiles.id has an Auth FK; do not grant the app access to auth.users.
do $migration$
declare f record; body text;
begin
  for f in select p.oid,p.proname,p.prosrc from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in
      ('clone_published_kitchen_design','create_kitchen_quote_request','read_customer_kitchen_quotes')
  loop
    body:=replace(f.prosrc,
      'perform 1 from auth.users where id=p_actor for share;',
      'perform 1 from public.profiles where id=p_actor for share;');
    if body=f.prosrc then raise exception 'Actor lookup body not recognised: %',f.proname; end if;
    if f.proname='clone_published_kitchen_design' then
      body:=replace(body,
        'where d.id=p_design and d.publication_status=''published'' and v.review_status=''approved''',
        'join public.merchant_stores s on s.id=d.store_id and s.active and s.store_type in (''factory'',''handmade'')
         join public.profiles owner_profile on owner_profile.id=s.owner_id and owner_profile.role=''merchant''
         where d.id=p_design and d.publication_status=''published'' and v.review_status=''approved''');
      body:=replace(body,'for share of d,v;','for share of d,v,s,owner_profile;');
    end if;
    execute replace(pg_get_functiondef(f.oid),f.prosrc,body);
  end loop;
end;
$migration$;

-- CREATE OR REPLACE preserves existing grants; make the service-only boundary explicit.
revoke all on function public.clone_published_kitchen_design(uuid,uuid,uuid),
  public.create_kitchen_quote_request(uuid,uuid,uuid,uuid,jsonb,jsonb,text),
  public.read_customer_kitchen_quotes(uuid,integer,uuid) from public,anon,authenticated;
grant execute on function public.clone_published_kitchen_design(uuid,uuid,uuid),
  public.create_kitchen_quote_request(uuid,uuid,uuid,uuid,jsonb,jsonb,text),
  public.read_customer_kitchen_quotes(uuid,integer,uuid) to service_role;

notify pgrst,'reload schema';
commit;
