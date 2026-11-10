-- Read-only. Run AFTER supabase/migrations/20261110_free_plan_edit_at_limit_keeps_public.sql. Changes nothing. Send the one-row result.
select jsonb_build_object(
  'trigger_exists', exists(select 1 from pg_trigger where tgrelid = 'public.galleries'::regclass and tgname = 'trg_enforce_gallery_limit' and not tgisinternal),
  'function_skips_limit_for_existing_rows', (select position('v_is_edit' in pg_get_functiondef('public.enforce_gallery_limit()'::regprocedure)) > 0),
  'function_still_forces_public_for_free', (select position('new.visibility := ''PUBLIC''' in pg_get_functiondef('public.enforce_gallery_limit()'::regprocedure)) > 0),
  'free_profiles_total', (select count(*) from public.profiles where tier is null or tier = 'FREE'),
  'free_profiles_at_or_over_limit', (select count(*) from (select p.id from public.profiles p left join public.galleries g on g.profile_id = p.id where p.tier is null or p.tier = 'FREE' group by p.id, p.bonus_galleries having count(g.id) >= 4 + coalesce(p.bonus_galleries, 0)) x),
  'free_profile_exhibitions_not_public', (select count(*) from public.galleries g join public.profiles p on p.id = g.profile_id where (p.tier is null or p.tier = 'FREE') and g.visibility <> 'PUBLIC')
) as validation;
-- Expected: trigger_exists true, both function checks true, free_profile_exhibitions_not_public 0 (unchanged by this migration: it touches no rows).
