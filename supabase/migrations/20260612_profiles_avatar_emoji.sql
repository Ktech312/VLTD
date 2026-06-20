-- Migration: add avatar_emoji to profiles table
-- Run in Supabase SQL editor

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS avatar_emoji text DEFAULT '🗝️';
