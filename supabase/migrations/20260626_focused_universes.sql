alter table public.profiles
  add column if not exists focused_universes text[] default null;
-- null means "show all" — explicitly set array means filtered view
