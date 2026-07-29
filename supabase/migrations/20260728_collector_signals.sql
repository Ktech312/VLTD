-- Collector Signals for the VLT Lounge — market-wide aggregates.
-- SECURITY DEFINER so it can total across all users, but it returns ONLY
-- aggregate numbers (no rows / no PII). Safe to expose to anon/authenticated.
--
-- Sources:
--   public.sales       (sale_price numeric, sold_at timestamptz)
--   public.vault_items (status text, is_public bool, is_deleted bool)

create or replace function public.get_collector_signals()
returns table(
  active_listings bigint,
  sales_7d        bigint,
  volume_7d       numeric,
  pulse_pct       numeric
)
language sql
security definer
stable
as $$
  with s7 as (
    select count(*)::bigint as c, coalesce(sum(sale_price), 0) as v
    from public.sales
    where sold_at >= now() - interval '7 days'
  ),
  s14 as (
    select coalesce(sum(sale_price), 0) as v
    from public.sales
    where sold_at >= now() - interval '14 days'
      and sold_at <  now() - interval '7 days'
  ),
  listings as (
    select count(*)::bigint as c
    from public.vault_items
    where status = 'FOR_SALE'
      and is_public = true
  )
  select
    (select c from listings)                                             as active_listings,
    (select c from s7)                                                   as sales_7d,
    (select v from s7)                                                   as volume_7d,
    case
      when (select v from s14) > 0
        then round((((select v from s7) - (select v from s14)) / (select v from s14)) * 100, 1)
      else 0
    end                                                                  as pulse_pct;
$$;

grant execute on function public.get_collector_signals() to anon, authenticated;
