-- Upcoming Comics: Want / Pre-ordered / Own per saved issue.
-- Existing saved rows become "want" (what they meant before this column).
-- Safe to run more than once.

alter table public.comic_wishlist
  add column if not exists status text not null default 'want';

alter table public.comic_wishlist
  drop constraint if exists comic_wishlist_status_check;

alter table public.comic_wishlist
  add constraint comic_wishlist_status_check
  check (status in ('want', 'preordered', 'own'));
