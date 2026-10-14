# Walkthrough index — QA pass of 2026-10-14

Tested against production `vltd.app`, commit `e83adc7` (desktop pane and emulated 320 / 390 px viewports; **no physical phone**). All data is synthetic (QA account "Marlowe Finch", item "1962 Gibson ES-335 Cherry (QA sample)", exhibition "Finch Vintage Guitar Showcase"). Email addresses, passwords and links are intentionally not shown anywhere in these notes.

**Status of media:** no screen recordings and no numbered screenshot set were captured in this pass (the Browser pane cannot record video, and clean, redacted screenshots were not saved). Each workflow below has verified steps, an expected result and a narration script; capturing footage is still to do and should be done from a fresh QA account against the commit listed above. Instructions are outdated if the app changes after `e83adc7`.

| # | Workflow | Verified live? | File |
|---|----------|----------------|------|
| 1 | Log in with a password, finish onboarding (personal) | Yes | [workflows.md#1](workflows.md) |
| 2 | Add an item (Quick Add), see the save status | Yes | [workflows.md#2](workflows.md) |
| 3 | Create and delete an exhibition | Yes | [workflows.md#3](workflows.md) |
| 4 | Reset a forgotten password from the emailed link | Yes | [workflows.md#4](workflows.md) |
| 5 | Spreadsheet import | Local test harness only; live UI walkthrough **not captured** | [workflows.md#5](workflows.md) |
| 6 | Business profile creation / switching | **Not exercised in this pass** (verified earlier 2026-10-13/14, see HANDOFF.md) | — |

Outlines for video use the same footage: a short social cut (workflow 2 + 3, 30–45 s) and a longer Help video (workflows 1–4, ~4 min). Not published anywhere.
