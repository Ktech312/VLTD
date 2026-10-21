# Stage 2: applied by you; VERIFIED on production by me (2026-10-21)

The view `public_galleries` exists and the link functions answer with sanitised rows. Verified with isolated QA exhibitions (ordinary, a deliberately hostile alias exhibition, private, guest-only, draft) as a visitor, an unrelated signed-in account (QA account B) and the owner (QA account A). Result: **31 passed, 1 expected "still open" (RB19-054 region: the old table read, closed only by stage 4)** in the final run (rows RB19-033 to RB19-064; first run RB19-001 to RB19-032 kept; RB19-065 explains the one first-run test mistake). Evidence: `evidence/rb19-stage2-second.json` / `.log`, first run `rb19-stage2-first.*`.

| Check | Result |
|---|---|
| View rows for visitor / unrelated account / owner | only public + active QA exhibitions (not private, guest-only, draft) |
| View columns | exactly the 15 allowlisted columns (no visitor keys, curator notes, last-viewed time, updated_at) |
| Alias row in the view | profile id empty, alias name kept; no alias exhibition anywhere in the account's view names a profile |
| Hostile row in the view | none of the planted secrets survive (owner email, private note, hidden title and images, visitor key, per-item value); only allowlisted layout keys; hidden item keeps id / hidden / blur thumbnail / created time; non-text item ids dropped |
| Ordinary exhibition in the view | content unchanged (titles, theme, sections), profile id kept; the view lists every public exhibition in the account (49 = table count) |
| Share link, visitor and unrelated account | hostile alias exhibition: profile id empty, notes empty, no visitor keys, no last-viewed time, no secrets; guest-only: sanitised; ordinary: content intact |
| Share link, owner | still the whole row |
| Share link, private / draft | nothing for a visitor or unrelated account; the owner still reaches their private one |
| Invite link, visitor | hostile alias exhibition sanitised; private nothing; items still load |
| Site (stage 2 changes nothing the pages read) | share page (ordinary and hostile alias, shown under the alias, no secret on the page), invite page (as signed-in account B: invitations are for registered users), guest page, Discover: all render |
| Old table read | visitor still reads the real profile id and notes from the table: expected, closed only by stage 4 |

Still to do on your side: run `sql/validation-stage2.sql` (one query, one result cell) and send the output: it checks every real exhibition in the account (allowlist, hidden items, link responses), which my QA-data run cannot.
Next: stage 3 (site change). Not started; requested separately.
