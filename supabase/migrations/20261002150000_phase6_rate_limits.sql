begin;

create table public.api_rate_limit_buckets (
  scope text not null check (scope ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  identity_hash text not null check (identity_hash ~ '^[0-9a-f]{64}$'),
  window_start timestamptz not null,
  requests integer not null check (requests > 0),
  expires_at timestamptz not null,
  primary key (scope, identity_hash, window_start)
);

create index api_rate_limit_buckets_expiry
  on public.api_rate_limit_buckets (expires_at);

alter table public.api_rate_limit_buckets enable row level security;
revoke all on public.api_rate_limit_buckets from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.api_rate_limit_buckets to service_role;

create function public.consume_api_rate_limit(
  p_scope text,
  p_identity text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_window_start timestamptz;
  v_reset_at timestamptz;
  v_requests integer;
begin
  if p_scope is null or p_scope !~ '^[a-z0-9][a-z0-9_-]{0,63}$'
    or p_identity is null or p_identity !~ '^[0-9a-f]{64}$'
    or p_limit is null or p_limit not between 1 and 1000000
    or p_window_seconds is null or p_window_seconds not between 1 and 86400 then
    raise exception 'Invalid rate limit request' using errcode = '22023';
  end if;

  v_window_start := pg_catalog.to_timestamp(
    pg_catalog.floor(extract(epoch from v_now) / p_window_seconds)
      * p_window_seconds
  );
  v_reset_at := v_window_start + pg_catalog.make_interval(secs => p_window_seconds);

  insert into public.api_rate_limit_buckets as current_bucket
    (scope, identity_hash, window_start, requests, expires_at)
  values
    (p_scope, p_identity, v_window_start, 1, v_reset_at + interval '1 day')
  on conflict (scope, identity_hash, window_start) do update
    set requests = current_bucket.requests + 1
  returning requests into v_requests;

  return pg_catalog.jsonb_build_object(
    'allowed', v_requests <= p_limit,
    'retryAfter', greatest(
      1,
      ceil(extract(epoch from (v_reset_at - v_now)))::integer
    )
  );
end;
$$;

revoke all on function public.consume_api_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, text, integer, integer)
  to service_role;

create function public.prune_api_rate_limits()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from public.api_rate_limit_buckets
  where expires_at <= pg_catalog.clock_timestamp();
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.prune_api_rate_limits() from public, anon, authenticated;
grant execute on function public.prune_api_rate_limits() to service_role;

commit;
