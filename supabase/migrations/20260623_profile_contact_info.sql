-- Add contact / shipping info fields to profiles.
-- These are private to the owner (not surfaced on public profiles).

alter table public.profiles
  add column if not exists full_name    text,
  add column if not exists phone        text,
  add column if not exists address_line1 text,
  add column if not exists address_line2 text,
  add column if not exists city         text,
  add column if not exists state        text,
  add column if not exists zip          text,
  add column if not exists country      text default 'US';
