-- ─────────────────────────────────────────────────────────────
-- Real cloud-synced Documents (certs, receipts, IDs) -- PRIVATE bucket.
--
-- Was local-only: files lived only in the browser's IndexedDB, no cloud
-- sync at all, no way to actually share a document with anyone (an
-- insurance company, a buyer wanting proof of authenticity, etc.) even
-- though "share" is the whole point of a lot of what VLTD does elsewhere.
--
-- Every OTHER storage bucket in this app (vault-images, avatars,
-- vault-videos, bug-screenshots) is public -- fine for those, since photos
-- are meant to be shown once an item is actually shared/exhibited. Documents
-- are different: they're private by default and ONLY become visible to
-- someone else when the owner explicitly generates a share link for that
-- one document (a signed, time-limited Supabase Storage URL) -- never a
-- permanent public URL like the other buckets use.
--
-- Safe to re-run (idempotent).
-- ─────────────────────────────────────────────────────────────

-- ── 1. Private bucket ─────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('vault-documents', 'vault-documents', false)
on conflict (id) do update set public = false;

-- Owner-only, on every operation -- no "public can read" policy at all
-- (that's the one bucket-level difference from vault-images/vault-videos).
-- Folder is auth.uid(), same convention every other bucket in this app
-- already uses -- precise per-PROFILE isolation (for multi-profile
-- accounts) is enforced by the vault_documents table below instead.
drop policy if exists "Users can upload their own documents" on storage.objects;
create policy "Users can upload their own documents"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'vault-documents' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users can read their own documents" on storage.objects;
create policy "Users can read their own documents"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'vault-documents' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users can delete their own documents" on storage.objects;
create policy "Users can delete their own documents"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'vault-documents' and auth.uid()::text = (storage.foldername(name))[1]);

-- ── 2. Metadata table ─────────────────────────────────────────────
-- The actual file bytes live in storage above; this row is what lets the
-- app list "which documents does item X have" and know their storage path
-- to sign a URL for. profile_id-scoped (not just auth.uid()) so one login
-- with multiple profiles keeps each profile's documents separate, same
-- convention as public.sales.
create table if not exists public.vault_documents (
  id            text primary key,
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  item_id       text not null,
  storage_path  text not null,
  name          text not null,
  content_type  text,
  added_at      timestamptz not null default now()
);

create index if not exists vault_documents_item_idx
  on public.vault_documents(item_id);

alter table public.vault_documents enable row level security;

drop policy if exists "Owners manage their documents - select" on public.vault_documents;
create policy "Owners manage their documents - select"
  on public.vault_documents for select
  using (profile_id in (select id from public.profiles where user_id = auth.uid()));

drop policy if exists "Owners manage their documents - insert" on public.vault_documents;
create policy "Owners manage their documents - insert"
  on public.vault_documents for insert
  with check (profile_id in (select id from public.profiles where user_id = auth.uid()));

drop policy if exists "Owners manage their documents - delete" on public.vault_documents;
create policy "Owners manage their documents - delete"
  on public.vault_documents for delete
  using (profile_id in (select id from public.profiles where user_id = auth.uid()));
