# Friendly Glass icon theme v1

This is the complete friendly 3D/glass counterpart for the 109 semantic names in `src/components/ui/AppIcon.tsx` at main commit `3f0d297`.

## Contents

- `icons/`: 109 individually named 256 x 256 RGBA PNG files. The filename matches the `AppIconName` exactly.
- `sheets/`: seven 4 x 4 source sheets, retained for review and future re-export.
- `manifest.json`: complete name-to-file and name-to-sheet mapping.
- `CODER-HANDOFF.md`: source-checked integration and verification instructions.
- `GENERATION-NOTES.md`: visual brief and production notes.

## Intended use

The theme is intentionally optional. Keep the current line-art theme as the default and expose this as **Friendly Glass** in the existing theme picker. The theme must be selected centrally; pages must not import individual icon files or make their own theme decisions.

The PNGs are designed to scale down from 256 px, but the strongest presentation is at 40 px and above. Preserve each existing icon container's dimensions during the trial so switching styles does not move buttons, labels, or navigation.

## Validation completed

- 109 names match the current `AppIconName` union exactly.
- Every individual icon is 256 x 256.
- Every individual icon is an RGBA PNG with an alpha channel.
- The seven contact sheets are mapped in `manifest.json`.

