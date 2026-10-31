# Unrelated discoveries (recorded, not acted on)

Found while doing the work above; none was fixed because none was asked for.

1. **Global button text colour.** `globals.css` has `select, option, input, button, textarea { color: inherit }` outside any style layer, so it beats Tailwind text-colour classes on every button. Any button whose look depends on a `text-*` class is showing the inherited colour instead. Only the dark-on-silver call-to-action buttons were corrected (inline colour). Changing the rule itself would restyle buttons site-wide.
2. **Bulk upload review shows "Scan with AI" to accounts without AI.** The first step hides the AI scan button for such accounts, but each item in the review step still shows "Scan with AI". It was never pressed; the server's owner-only gate refuses other accounts.
3. **Account menu on a 320 px screen scrolls**: the Support row (the way to Report a bug) is below the visible part until you scroll inside the menu.
4. **Fixture removal does not delete uploaded pictures.** The synthetic-account clean-up script removes items, exhibitions, profile and user but has no storage step; pictures are removed by a separate script (`reset-qa.cjs`). The storage folders of every test account used in this work were checked afterwards and held nothing.
5. **The exhibition builder keeps its page names and descriptions inside the exhibition's own `exhibition_layout` data**, not in a separate table (a table I first assumed does not exist). Not a defect; noted because it affects how that data would be exported or queried.
6. **Quick Add's camera screen fills the page down to the bottom bar** (the "last content clear of the bar" check reads false there by design).
7. **Vault list thumbnails are 42 px wide (32 at 320 px)** and sit beside the row's title link.
