# VLTD Consolidated Handoff

Last consolidated: May 15, 2026

This is the single "start here" document for continuing VLTD work. It combines the useful context from the older VLTD handoff, marketing, and strategy notes so those old chats/files can be archived after review.

## Product North Star

VLTD is a private collector vault first, with museum-grade presentation and selling support layered on only after trust is earned.

Core promise: every category, one vault. Collectors should be able to scan, document, value, insure, share, and eventually sell collectibles without being trapped in a closed ecosystem.

Priority stack:

1. Vault: private inventory, photos, provenance, cost basis, value, insurance documentation.
2. Gallery/Museum: beautiful public or private presentation of selected pieces.
3. Intelligence: condition, notable/key item detection, valuation ranges, registry/completion insights.
4. Sale: for-sale state, listing copy, net proceeds, platform-specific prep, later marketplace integrations.

Voice: confident, specific, collector-native, privacy-first. Avoid hype that a serious collector would distrust.

## Current App State

Stack:

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS v4
- Supabase support
- Browser-side localStorage still powers many vault flows

Important implemented areas found in code:

- Vault model supports `FOR_SALE`, `askingPrice`, `conditionReason`, `conditionSource`, `edition`, `variant`, `printRun`, `isFirstEdition`, multi-image fields, pricing ranges, comparables, and price sources.
- Vault export exists through `src/lib/vaultExport.ts` and `src/components/VaultExportButton.tsx`, including CSV/JSON and insurance PDF entry.
- Insurance PDF exists through `src/lib/insurancePdf.ts` and `src/components/InsurancePdfButton.tsx`.
- AI condition grading exists through `conditionReason` handling, `ConditionAssessmentPanel`, scan route response fields, and scan add flow mapping.
- Notable/key item detection exists through `src/lib/itemIntelligence.ts`, `NotableBadge`, vault cards, item detail, swipe stack, and museum view.
- Portfolio net proceeds exists through `PortfolioNetProceedsPanel` and `getNetProceedsEstimate`.
- Haul Mode exists through `src/lib/haulSession.ts`, `HaulReviewSheet`, `/vault/add` integration, vault entry point, HUD, and batch review.
- Collection goals/completion exists through `src/lib/collectionGoals.ts`, `/goals`, `GoalCard`, `AddGoalSheet`, and portfolio widget wiring.
- Museum view exists as the default-style vault presentation through `VaultMuseumView`, `VaultInner`, universe views, museum routes, gallery renderers, and museum background settings.
- Enhanced capture dependencies are installed: `@tensorflow-models/coco-ssd`, `@tensorflow/tfjs`, `@imgly/background-removal`, `tesseract.js`, `@zxing/library`.

## Completed / Shipped Feature Groups

- Scan autofill flow: barcode/OCR/AI fills fields with confidence handling.
- Vault add header cleanup and unsaved-change guard.
- Activity page with recent vault, value, sales activity, and basic stats.
- Data export: CSV/JSON vault export.
- Portfolio-level "Net if sold today".
- Notable/key item rules and badge.
- Want list improvements, including richer model and UI.
- Variant/edition fields on vault items.
- SwipeStack/gallery and shelf/flip/museum view modes.
- Vault Registry first pass: subject field, ranking widget/filter concepts.
- Collection Goals first pass: self-defined completion targets.
- Multi-marketplace pricing MVP: low/median/high, comparables, marketplace suggestion links.
- AI condition grading: universe-specific prompt/fields/panel/filter/export path.
- For Sale toggle/listing polish: `FOR_SALE`, asking price, listing gate, badges, filters, generator upgrades.
- Stream/content mode: item presentation route with reveal/aspect controls.
- Insurance documentation PDF export.
- Haul Mode/bulk rapid scan.
- Museum fixes and carousel UX improvements.

## Highest-Value Next Work

1. Enhanced Capture + Image Studio

   Source note: `VLTD-Coder-Handoff-EnhancedCapture.md`

   Goal: make every item photo feel museum-worthy. Build guided capture overlays, real-time alignment help, blur/object detection warnings, edit sheet with filters/adjustments, background removal, and creative backgrounds.

   Current code already has some capture support and dependencies, so this should start with an audit of `src/components/CameraCapturePanel.tsx`, `src/components/capture/*`, and `/vault/add` before adding new files.

2. Museum Detail / Carousel Polish

   Source notes: `VLTD-Coder-Handoff-MuseumFixes.md`, `VLTD-Coder-Handoff-MuseumCarouselUX.md`, `VLTD-Coder-Handoff-MuseumActiveCardFix.md`, `VLTD-Coder-Handoff-SpotlightFix.md`, `VLTD-Coder-Handoff-GalleryHeroFix.md`

   Goal: make museum the flagship experience. Verify active card centering, drag-scroll, arrow behavior, card sizing, value pills, spotlight sizing, hero height, and item detail cleanup.

3. Supabase/Post-Launch Features

   Source notes: `VLTD-Dev-Tasks.md`, `VLTD-Feature-Intelligence.md`

   Best next bets after real users:

   - Global registry leaderboards per subject.
   - Public registry pages like `/registry/[subject]`.
   - Weekly vault report email.
   - Recent comparable sales with thumbnails and "use this as my value".
   - Rarity intelligence from population reports/census data.
   - Offline capture/convention mode.
   - CSV import from Beckett/CollX/spreadsheets.

4. Marketing Launch Package

   Source notes: `VLTD-Brand-Positioning.md`, `VLTD-Landing-Page-Copy.md`, `VLTD-Marketing-Plan.md`, `VLTD-Marketing-Content-Drafts.md`, `VLTD-Competitive-Analysis.md`

   Immediate launch angles:

   - "Your collection deserves a real home."
   - "One vault. Every universe."
   - "Your collection is yours. We're just the vault."
   - Insurance documentation as the practical hook.
   - Public gallery/museum as the sharing hook.
   - Data export as the trust hook.
   - Haul Mode and scan demos as the video hook.

## Architecture Notes To Preserve

- Prefer localStorage-compatible optional fields unless a feature truly needs a migration.
- Keep data portability visible: export is a trust feature, not just a utility.
- Insurance docs should include photos, values, condition, provenance, and comparable/price source support where available.
- Public sharing must never expose the full private vault unless the user explicitly chooses it.
- `FOR_SALE` is an intermediate state, separate from `SOLD`; do not collapse those states.
- Museum/galleries are curated presentation surfaces; vault remains the private source of truth.
- Collection completion Phase 1 is self-reported goals, not a global catalog dependency.
- Registry Phase 1 can use local subject fields; global rankings require Supabase/user base.

## Validation Commands

Use these after meaningful code changes:

```powershell
npm run build
npm run lint
```

For UI-heavy changes, start the dev server and visually check desktop and mobile:

```powershell
npm run dev
```

## Old Files That Can Be Archived After This

These appear to be source/handoff fragments now covered by this consolidated handoff:

- `VLTD-Coder-Handoff-Safe-Next.md`
- `VLTD-Coder-Handoff-Remaining.md`
- `VLTD-Coder-Handoff-CollectionCompletion.md`
- `VLTD-Coder-Handoff-ConditionGrading.md`
- `VLTD-Coder-Handoff-ForSale.md`
- `VLTD-Coder-Handoff-HaulMode.md`
- `VLTD-Coder-Handoff-InsurancePDF.md`
- `VLTD-Coder-Handoff-MuseumView.md`
- `VLTD-Coder-Handoff-MuseumFixes.md`
- `VLTD-Coder-Handoff-MuseumCarouselUX.md`
- `VLTD-Coder-Handoff-MuseumActiveCardFix.md`
- `VLTD-Coder-Handoff-GalleryHeroFix.md`
- `VLTD-Coder-Handoff-SpotlightFix.md`
- `VLTD-Coder-Handoff-PriceSources.md`
- `VLTD-Coder-Handoff-StreamMode.md`
- `VLTD-Coder-Handoff-SwipeStack.md`
- `VLTD-Coder-Handoff-VaultRegistry.md`

Keep these around until launch copy/strategy is finalized, or archive them together once the launch page is locked:

- `VLTD-Brand-Positioning.md`
- `VLTD-Landing-Page-Copy.md`
- `VLTD-Marketing-Plan.md`
- `VLTD-Marketing-Content-Drafts.md`
- `VLTD-Competitive-Analysis.md`
- `VLTD-Feature-Intelligence.md`
- `VLTD-Dev-Tasks.md`

Keep these operational scripts:

- `codex_quarantine_large_threads.ps1`
- `codex_repair_blank_chats.ps1`

## Codex Chat Cleanup Status

The active `C:\Users\EK\.codex\sessions` folder has no remaining `.jsonl` sessions over 25 MB as of this consolidation.

Large frozen chat files were already moved to:

```text
C:\Users\EK\.codex\quarantine\large-thread-freeze-20260515-221237
```

That quarantine includes four very large sessions, including one around 447 MB and one around 183 MB. This was almost certainly the source of the lockups.

Do not delete the quarantine until you are sure this consolidated handoff and the repo handoff files have everything you need. If the app is stable for a day, the quarantine can be moved to external backup or deleted.

## Restart Prompt For A Fresh Chat

Use this in a new Codex chat:

```text
Read C:\Users\EK\VLTD\VLTD-Consolidated-Handoff.md first. Treat it as the source of truth for VLTD product direction and current status. Then inspect the code before changing anything. The likely next task is Enhanced Capture + Image Studio, unless I say otherwise.
```
