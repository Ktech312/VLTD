# Proposal (NOT applied): an old share link still reads an exhibition after it is made Private

Found 2026-10-17 while checking account isolation (queue F), with a synthetic QA exhibition only.

## What happens today
`get_gallery_by_share_token(p_token)` and `get_gallery_items_by_share_token(p_token)` (migration `20260823_fix_gallery_share_and_invite_tokens.sql`) are `security definer` and look the exhibition up by token with no check of its visibility. Anyone who holds an old link can call them directly (no sign-in needed) and get the whole row back, even when the owner has since set the exhibition to **Private** (`visibility = 'LOCKED'`).

Measured on a QA exhibition set to LOCKED, called as a signed-out visitor:
- exhibition row returned: title, description, `layout` (with the item snapshots), `exhibition_layout`, `item_notes`, alias fields, analytics counters, `public_token`;
- items function returned its rows (`id, gallery_id, position, artifact_id`).

The app's own page hides it (the link page shows nothing for a private exhibition, checked), so a normal visitor never sees it. The data is still reachable by calling the function directly. The token is random and unguessable, so this affects people who were given the link earlier, not strangers.

## Proposed change (one SQL run by EK; link only, not run by me)
Add `and visibility <> 'LOCKED'` to both functions. A private exhibition's old link then returns nothing, which matches the "Private" wording in the Share panel. The owner still reads their own private exhibition through their normal signed-in access.

```sql
create or replace function public.get_gallery_by_share_token(p_token text)
returns setof public.galleries language sql stable security definer set search_path = public as $$
  select * from public.galleries where public_token = p_token and visibility <> 'LOCKED' limit 1;
$$;

create or replace function public.get_gallery_items_by_share_token(p_token text)
returns setof public.gallery_items language sql stable security definer set search_path = public as $$
  select gi.* from public.gallery_items gi
  join public.galleries g on g.id = gi.gallery_id
  where g.public_token = p_token and g.visibility <> 'LOCKED'
  order by gi.position asc;
$$;
```

## Before applying
- Confirm no screen relies on the token functions to show the OWNER their own private exhibition (the owner view uses signed-in access; the share page is the only caller found).
- After applying, rerun `scripts/ui-isolation.cjs` ([F7] line "private exhibition's token") and expect "gotRow: false".
- Related, existing: "regenerate link" already exists for the owner; a Private switch should arguably also be enough.
