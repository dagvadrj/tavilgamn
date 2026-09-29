create or replace function public.read_featured_merchants(p_limit integer default 6)
returns jsonb
language plpgsql
stable
set search_path to ''
as $function$
declare
  safe_limit integer := least(greatest(coalesce(p_limit, 6), 1), 12);
  result jsonb;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'name', s.name,
        'storeType', s.store_type,
        'city', s.city,
        'district', s.district,
        'description', s.description,
        'image', s.image,
        'categories', s.categories,
        'featuredRank', s.featured_rank
      )
      order by s.featured_rank asc, s.featured_at asc, s.created_at asc
    ),
    '[]'::jsonb
  )
  into result
  from (
    select *
    from public.merchant_stores
    where active = true
      and is_featured = true
      and featured_rank is not null
    order by featured_rank asc, featured_at asc, created_at asc
    limit safe_limit
  ) s;

  return result;
end
$function$;
