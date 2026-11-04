-- ─────────────────────────────────────────────────────────────
-- Business member access (2026-11-03)
-- =============================================================
-- Problem: a person added on a business's Team page is on the roster (profile_members) and the database already lets
-- them read the business's items, exhibitions and roster, but they could never SEE the business: the profiles table
-- only answers for its owner, and the app builds its profile list / switcher from that table. So the business never
-- appeared in their profile list, they could not switch into it, and the Team and Workspace pages sent them away.
--
-- Fix: one read-only function that returns, for the signed-in person, the BUSINESS profiles they were added to
-- (role admin or member) with only the columns the app needs to show and switch into them. Nothing in
-- profiles' own access rules is loosened, so contact details, tax id, billing and AI-usage columns stay owner-only.
--
-- What it does NOT do:
--   * it never returns the caller's own profiles (those come from the normal query),
--   * it never returns personal profiles (a personal collection stays private to its owner even if a membership row exists),
--   * it returns nothing to a signed-out caller, and nothing for someone who has been removed (the membership row is the only gate).
--
-- Safe to re-run. The app works without it (members just do not see the business yet).
-- ─────────────────────────────────────────────────────────────

create or replace function public.list_member_profiles()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',                   p.id,
        'username',             p.username,
        'display_name',         p.display_name,
        'profile_type',         p.profile_type,
        'bio',                  p.bio,
        'avatar_url',           p.avatar_url,
        'avatar_emoji',         p.avatar_emoji,
        'primary_focus',        p.primary_focus,
        'is_public',            p.is_public,
        'created_at',           p.created_at,
        'business_type',        p.business_type,
        'website',              p.website,
        'tier',                 p.tier,
        'tier_expires_at',      p.tier_expires_at,
        'tier_source',          p.tier_source,
        'onboarding_completed', p.onboarding_completed,
        'member_role',          m.role
      )
      order by p.created_at, p.id
    ),
    '[]'::jsonb
  )
  from public.profile_members m
  join public.profiles p on p.id = m.profile_id
  where auth.uid() is not null
    and m.user_id = auth.uid()
    and m.role in ('admin', 'member')
    and p.profile_type = 'business'
    and p.user_id is distinct from auth.uid();
$$;

revoke all on function public.list_member_profiles() from public;
revoke all on function public.list_member_profiles() from anon;
grant execute on function public.list_member_profiles() to authenticated;
