-- READ-ONLY. Changes nothing. Shows the rules that exist today around referral codes, so the next change is written against the real thing.
-- Run it in the Supabase SQL editor and paste the whole result table back. (If the editor shows a table warning dialog, "Run without RLS" is the safe button: this query only reads.)
select kind, name, detail from (
  select 1 as o, 'row-level security' as kind, c.relname::text as name,
         case when c.relrowsecurity then 'ON' else 'OFF' end || ', forced: ' || c.relforcerowsecurity::text as detail
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname in ('referral_codes', 'referral_redemptions', 'user_perks')
  union all
  select 2, 'policy', p.tablename::text || ' / ' || p.policyname::text,
         'for ' || p.cmd || ' to ' || array_to_string(p.roles, ',') || ' | using: ' || coalesce(p.qual, '-') || ' | with check: ' || coalesce(p.with_check, '-')
  from pg_policies p
  where p.schemaname = 'public' and p.tablename in ('referral_codes', 'referral_redemptions', 'user_perks')
  union all
  select 3, 'table grant', c.relname::text || ' / ' || case when a.grantee = 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end, string_agg(a.privilege_type, ', ' order by a.privilege_type)
  from pg_class c join pg_namespace n on n.oid = c.relnamespace, aclexplode(c.relacl) a
  where n.nspname = 'public' and c.relname in ('referral_codes', 'referral_redemptions', 'user_perks')
  group by c.relname, a.grantee
  union all
  select 4, 'function', p.proname::text || '(' || pg_get_function_identity_arguments(p.oid) || ')',
         'security definer: ' || p.prosecdef::text || ' | who may run it: ' || coalesce((select string_agg(case when x.grantee = 0 then 'PUBLIC' else pg_get_userbyid(x.grantee) end, ', ') from aclexplode(p.proacl) x where x.privilege_type = 'EXECUTE'), 'default (PUBLIC)')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and (p.proname ilike '%perk%' or p.proname ilike '%referral%' or p.proname ilike '%vltd_admin%' or p.proname ilike '%vltd_owner%')
  union all
  select 5, 'function body', p.proname::text, replace(pg_get_functiondef(p.oid), E'\n', ' ')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and (p.proname ilike '%perk%' or p.proname ilike '%referral%' or p.proname ilike '%vltd_admin%' or p.proname ilike '%vltd_owner%')
  union all
  select 6, 'trigger', c.relname::text || ' / ' || t.tgname::text, replace(pg_get_triggerdef(t.oid), E'\n', ' ')
  from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname in ('referral_codes', 'referral_redemptions', 'user_perks') and not t.tgisinternal
  union all
  select 7, 'constraint', c.relname::text || ' / ' || k.conname::text, pg_get_constraintdef(k.oid)
  from pg_constraint k join pg_class c on c.oid = k.conrelid join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname in ('referral_codes', 'referral_redemptions', 'user_perks')
) s
order by o, name;
