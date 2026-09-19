-- ─────────────────────────────────────────────────────────────
-- Private Photos (paid feature) — architecture decided 2026-09-19 after
-- weighing it directly with EK: a second, PRIVATE Storage bucket that one
-- specific photo migrates into on-demand, the moment a paying user marks
-- that item Private. Deliberately NOT a rewrite of how every image in the
-- app is served (signed URLs for everyone) — that would add non-cacheable
-- request overhead to every photo view for every user, paid or not, and
-- touch every screen that shows an image (Vault, Exhibitions, the museum,
-- sharing, social previews). This is additive instead: free accounts and
-- every existing photo are completely untouched, still on the existing
-- public `vault-images` bucket exactly as today.
--
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('vault-images-private', 'vault-images-private', false)
on conflict (id) do update set public = false;

-- Folder is auth.uid(), matching vault-documents' own convention (the one
-- other private bucket in this app, see 20260822_vault_documents.sql) --
-- only a user who belongs (owner, admin, or member — profile_members
-- covers all three, backfilled for every existing profile, see
-- 20260707_profile_members.sql) to a profile with a paid tier can upload
-- here at all. Read/delete only check ownership of the folder, not tier —
-- a photo already made private stays private and stays yours to manage
-- even if a subscription later lapses; only uploading NEW private photos
-- requires an active paid tier.
drop policy if exists "Paid members can upload private vault photos" on storage.objects;
create policy "Paid members can upload private vault photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'vault-images-private'
    and auth.uid()::text = (storage.foldername(name))[1]
    and exists (
      select 1
      from public.profile_members m
      join public.profiles p on p.id = m.profile_id
      where m.user_id = auth.uid() and coalesce(p.tier, 'FREE') <> 'FREE'
    )
  );

drop policy if exists "Users can read their own private vault photos" on storage.objects;
create policy "Users can read their own private vault photos"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'vault-images-private' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users can delete their own private vault photos" on storage.objects;
create policy "Users can delete their own private vault photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'vault-images-private' and auth.uid()::text = (storage.foldername(name))[1]);
