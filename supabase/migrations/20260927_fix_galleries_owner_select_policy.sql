-- Root-cause fix for the exhibition create/delete regression found during
-- this pass's acceptance testing: new exhibitions never reached the cloud,
-- and deleting an existing one silently affected zero rows.
--
-- galleries had exactly one SELECT policy, "Public galleries are readable"
-- (visibility = 'PUBLIC' and state = 'ACTIVE'). There was no policy letting
-- a profile's own member/owner read a gallery they created that ISN'T
-- public/active yet — which is every gallery immediately after creation,
-- and any gallery in DRAFT/LOCKED/INVITE_ONLY state.
--
-- Root-caused exactly, not guessed: 20260707_profile_members.sql originally
-- created "galleries_manage_member" `for all`, which covered SELECT too.
-- 20260707_team_management.sql later dropped that single combined policy
-- and split it into galleries_insert_member / galleries_update_member /
-- galleries_delete_manager — but never recreated an equivalent SELECT
-- policy. Member-owned SELECT access on galleries was silently lost in
-- that refactor and has been missing since.
--
-- Confirmed directly (not just inferred): a disposable probe row inserted
-- with visibility='LOCKED' was invisible to a plain SELECT by its own
-- owner in the very same transaction, immediately after the insert. That
-- explains both symptoms this pass found — INSERT via PostgREST uses
-- Prefer: return=representation, which needs to read the new row back
-- afterward and reports the whole operation as an RLS violation when it
-- can't; the same missing visibility is the most likely mechanism for the
-- DELETE failures too, since is_profile_manager(profile_id) independently
-- evaluates true for the affected account.
--
-- This adds a second, additive PERMISSIVE select policy (Postgres ORs
-- multiple permissive policies for the same command) so a profile's own
-- members can always read their own galleries, regardless of visibility —
-- mirroring the exact same is_profile_member() check already used by
-- galleries_insert_member and galleries_update_member. The existing public
-- policy is untouched; public visitors still only see PUBLIC+ACTIVE rows.

drop policy if exists "galleries_select_member" on public.galleries;
create policy "galleries_select_member" on public.galleries
  for select to authenticated
  using (public.is_profile_member(profile_id));

-- Drops the three diagnostic functions used to root-cause the above
-- (debug_galleries_policies, debug_gallery_insert_probe,
-- debug_gallery_delete_probe_v2) now that they've served their purpose.
-- Read-only / self-cleaning in effect; nothing else is touched.
drop function if exists public.debug_galleries_policies();
drop function if exists public.debug_gallery_insert_probe();
drop function if exists public.debug_gallery_delete_probe_v2();
