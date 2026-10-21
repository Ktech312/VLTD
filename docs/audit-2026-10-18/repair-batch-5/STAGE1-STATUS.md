# Stage 1: VERIFIED on production (2026-10-21)

History: the first attempt (RB16-001) found the old event rules still in place; after you ran `sql/1-events-authorization-and-privacy.sql` the full check was rerun: **33 of 33 pass** (rows RB16-002 to RB16-034; evidence `evidence/rb16-stage1-second.log` / `rb16-stage1-second.json`, screenshots listed in the json). Synthetic exhibitions only; both QA profiles had 0 followers; the account held 0 events before and holds 0 after cleanup.

| Check | Result |
|---|---|
| Owner records an event for each of their own exhibitions (public, alias, private, guest-only, draft) | accepted (RB16-002) |
| Second QA account records an event for its own exhibition (control) | accepted (RB16-003) |
| A's profile + B's exhibition | refused 42501 (RB16-004) |
| B's profile (A not a member) + B's exhibition / + A's exhibition | refused 42501 (RB16-005, 006) |
| A's profile + a missing exhibition / a malformed id | refused 42501 (RB16-007, 008) |
| Unrelated account B in all three combinations; a signed-out visitor | refused (RB16-009 to 012); exactly the six legitimate events exist afterwards (RB16-013) |
| Visitor and unrelated account read events | only the public, alias-free exhibitions' events (RB16-014, 015); 0 alias / private / guest-only / draft events exposed (RB16-017) |
| Owner reads their events | all states (RB16-016, 023) |
| Switching an exhibition to Private, Guest View / Registered, draft, or alias on | its event is hidden from visitors and other accounts at once; back to public it is visible again (RB16-018 to 022) |
| Edit / delete an event, as owner or visitor | refused: permission denied (RB16-024 to 027) |
| Ownership helper | an unrelated account always gets false; a visitor cannot call it (RB16-028, 029); the public-check helper says false for alias (RB16-030) |
| Site: Announce on a synthetic exhibition | "✓ Announced", exactly one row (RB16-031) |
| Site: Make public | exhibition public, one "published" event, no "not notified" message; the event is then visible to a visitor because it is public without an alias (RB16-032, 033) |
| Site: Announce on an alias exhibition | works for the owner, row written, invisible to visitors (RB16-034) |

Not part of this migration (recorded separately, unchanged): broader table-grant tightening on `galleries` and `gallery_items`; visitor view counting that cannot persist. Real events: at the time of the last check `exhibition_events` holds 0 rows, so no real user has published or announced since stage 1 went in.

Stage 2 (view and link sanitising) is the next step; it is requested separately and only on your word.
