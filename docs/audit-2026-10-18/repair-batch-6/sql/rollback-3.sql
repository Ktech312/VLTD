-- Undo the view counter function.
drop function if exists public.record_exhibition_view(text, text);
