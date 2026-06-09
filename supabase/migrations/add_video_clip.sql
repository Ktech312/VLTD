-- ─── VLTD: Video Clip columns ─────────────────────────────────────────────────
-- Run this in the Supabase SQL Editor (Settings → SQL Editor → New query)
-- https://app.supabase.com/project/_/sql

ALTER TABLE vault_items
  ADD COLUMN IF NOT EXISTS video_clip_url       TEXT,
  ADD COLUMN IF NOT EXISTS video_clip_duration  NUMERIC;

-- ─── Vault Videos storage bucket ─────────────────────────────────────────────
-- After running the SQL above, also create the storage bucket manually:
--   1. Go to Storage in Supabase dashboard
--   2. Click "New bucket"
--   3. Name: vault-videos
--   4. Toggle "Public bucket" ON
--   5. Click Create
--
-- Then add a storage policy so authenticated users can upload to their own folder:
--   Policy name: "Authenticated users can manage their own videos"
--   Allowed operations: SELECT, INSERT, UPDATE, DELETE
--   Target roles: authenticated
--   Policy expression:
--     (auth.uid()::text = (storage.foldername(name))[1])
--
-- Or run these policy statements:

INSERT INTO storage.buckets (id, name, public)
VALUES ('vault-videos', 'vault-videos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload their own videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'vault-videos' AND (auth.uid()::text = (storage.foldername(name))[1]));

CREATE POLICY "Users can update their own videos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'vault-videos' AND (auth.uid()::text = (storage.foldername(name))[1]));

CREATE POLICY "Users can delete their own videos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'vault-videos' AND (auth.uid()::text = (storage.foldername(name))[1]));

CREATE POLICY "Public can read videos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'vault-videos');
