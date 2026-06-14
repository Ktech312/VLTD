# VLTD App Icon Concepts

These are concept-only. Nothing here has been wired into `public/manifest.json` or copied over the active app icons yet.

## Concepts

1. `01-vault-key.png`
   - Strongest connection to the existing VLTD key identity.
   - Slightly ornate; may lose fine detail at small sizes.

2. `02-vault-v-seal.png`
   - Strongest brand mark.
   - Clean, premium, readable, and closest to a traditional app icon.

3. `03-slab-vault.png`
   - Most clearly communicates "collector app."
   - Has more detail, so it is better for larger icons than tiny favicon use.

4. `04-keyhole-vault.png`
   - Most readable at small size.
   - Strong vault/security feel, but less specific to collectibles.

5. `05-v-seal-brushed-vault.png`
   - Baseline V kept upfront with a deeper brushed vault-door background.
   - Closest alternate to the chosen baseline.

6. `06-v-seal-leather-case.png`
   - Baseline V kept upfront with a black leather/collector-case background.
   - Warmer and more tactile; feels like a luxury case.

7. `07-v-seal-obsidian-glass.png`
   - Baseline V kept upfront with a blue-black obsidian glass background.
   - Most digital/app-like of the background variants.

8. `08-logo-v-wheel-obsidian.png`
   - Obsidian V direction with the logo's vault-wheel/key-head geometry brought forward.
   - Richest and most obviously connected to the original VLTD logo.

9. `09-logo-v-compact-key-obsidian.png`
   - Obsidian V direction with a compact vertical key silhouette behind the V.
   - Strong logo reference, but the lower key detail may be too small at app-icon sizes.

10. `10-logo-v-wheel-clean-obsidian.png`
   - Cleaner obsidian V direction with simplified wheel dots/spokes from the logo.
   - Best balance of app-icon readability and VLTD logo theme.

## Recommendation

Use `02-vault-v-seal.png` as the main app icon if the priority is brand recognition.

Use `03-slab-vault.png` if the priority is instantly communicating that VLTD is for collectors.

Use `04-keyhole-vault.png` if the priority is maximum small-size readability.

Selected for the active app icon set: `09-logo-v-compact-key-obsidian.png`.

## Preview Files

- `app-icon-concepts-contact-sheet.png`
- `app-icon-home-screen-preview.png`
- `v-seal-background-options-contact-sheet.png`
- `v-seal-background-options-home-screen.png`
- `logo-based-obsidian-options-contact-sheet.png`
- `logo-based-obsidian-options-home-screen.png`

## Next Step

After choosing a concept, generate production icon sizes from the selected master:

- `72x72`
- `96x96`
- `120x120`
- `144x144`
- `152x152`
- `180x180`
- `192x192`
- `512x512`
- `apple-touch-icon.png`

Then update or verify `public/manifest.json` uses the final icon set with `"display": "standalone"`.
