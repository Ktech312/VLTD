-- Rolls back 10-ai-scan-reservations.sql. The AI scan routes then fall back to the existing consume_bulk_scan(profile, 1) automatically
-- (no repeated-request recognition, no give-back after a provider failure). Scans already spent stay spent; the allowance numbers on profiles are not touched.
begin;
drop function if exists public.complete_ai_scan(uuid, uuid, boolean);
drop function if exists public.reserve_ai_scan(uuid, uuid, text);
drop function if exists public.ai_scan_numbers(uuid);
drop table if exists public.ai_scan_requests;
commit;
