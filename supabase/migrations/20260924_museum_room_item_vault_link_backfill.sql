-- Museum Runtime V2 — deterministic vault_item_id backfill for POP_CULTURE's
-- existing museum_room_items rows (2026-09-24).
--
-- Matches each museum_room_items.image_url to the real vault_items row it
-- was placed from — by EXACT storage-path containment, never by title —
-- since image_url was originally set from that item's own real Supabase
-- Storage path/URL at placement time (see getPrimaryImageUrl(),
-- src/lib/vaultModel.ts), which is unique per uploaded file. A match only
-- counts if it names EXACTLY ONE vault_items row; anything ambiguous is
-- left untouched (vault_item_id stays null, same safe fallback the app
-- already uses for any unmatched item).
--
-- Run PART 1 first and review the results. Only run PART 2 (the actual
-- write) once PART 1's matches look right — it only touches rows PART 1
-- would have shown.

-- ============================================================
-- PART 1 — preview only, no writes. Run this first and review.
-- ============================================================
with candidates as (
  select
    mri.id as museum_room_item_id,
    mri.title as museum_title,
    vi.id as vault_item_id,
    vi.title as vault_title
  from public.museum_room_items mri
  join public.vault_items vi
    on mri.room_id = 'POP_CULTURE'
    and mri.vault_item_id is null
    and (
      (vi.image_front_storage_path is not null and mri.image_url like '%' || vi.image_front_storage_path)
      or exists (
        select 1 from jsonb_array_elements(coalesce(vi.images_json, '[]'::jsonb)) as img
        where img ->> 'storageKey' is not null
          and mri.image_url like '%' || (img ->> 'storageKey')
      )
    )
),
unambiguous as (
  select museum_room_item_id, min(vault_item_id) as vault_item_id
  from candidates
  group by museum_room_item_id
  having count(distinct vault_item_id) = 1
)
select c.museum_room_item_id, c.museum_title, u.vault_item_id, c.vault_title
from candidates c
join unambiguous u using (museum_room_item_id, vault_item_id);

-- ============================================================
-- PART 2 — the actual write. Run only after reviewing PART 1.
-- ============================================================
-- with candidates as (
--   select
--     mri.id as museum_room_item_id,
--     vi.id as vault_item_id
--   from public.museum_room_items mri
--   join public.vault_items vi
--     on mri.room_id = 'POP_CULTURE'
--     and mri.vault_item_id is null
--     and (
--       (vi.image_front_storage_path is not null and mri.image_url like '%' || vi.image_front_storage_path)
--       or exists (
--         select 1 from jsonb_array_elements(coalesce(vi.images_json, '[]'::jsonb)) as img
--         where img ->> 'storageKey' is not null
--           and mri.image_url like '%' || (img ->> 'storageKey')
--       )
--     )
-- ),
-- unambiguous as (
--   select museum_room_item_id, min(vault_item_id) as vault_item_id
--   from candidates
--   group by museum_room_item_id
--   having count(distinct vault_item_id) = 1
-- )
-- update public.museum_room_items mri
-- set vault_item_id = u.vault_item_id, updated_at = now()
-- from unambiguous u
-- where mri.id = u.museum_room_item_id;
