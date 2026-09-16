# Coder handoff: install Friendly Glass as a switchable icon theme

## Goal

Install the complete 109-icon Friendly Glass pack behind one global **Classic / Friendly Glass** preference. Classic remains the default. A user can preview Friendly Glass and return to Classic without changing page code.

## Source-checked starting point

- Current main commit checked: `3f0d297`.
- `src/components/ui/AppIcon.tsx` owns all 109 semantic names and already has `compact`, `feature`, `navTop`, and `navBottom` variants.
- The current `feature` branch is still a placeholder made from the same SVG line art on a rounded backing.
- `src/components/ui/ThemePicker.tsx` is the existing global appearance control, used from Account and TopNav.
- `src/lib/ThemeContext.tsx` already persists the background theme and applies root HTML attributes/classes. Preserve its hydration guard; it fixed the prior refresh-reset bug.

## Assets

Source pack:

`design-assets/icon-themes/friendly-glass-v1/icons/*.png`

Copy the 109 runtime files to:

`public/ui/icon-themes/friendly-glass-v1/*.png`

Filenames exactly match `AppIconName`, so the runtime URL can be derived without a second hand-maintained mapping:

`/ui/icon-themes/friendly-glass-v1/${name}.png`

Keep `design-assets/icon-themes/friendly-glass-v1/manifest.json` as the audit manifest. Do not rename individual files.

## Implementation

1. Add an icon-style preference with exactly two values: `classic` and `friendly-glass`.
2. Persist it under a separate key such as `vltd_icon_style`. Default to `classic` when absent.
3. Extend the existing `ThemeContext` value with `iconStyle` and `setIconStyle`. Read the saved icon style during the same hydration phase as the existing theme. Do not persist either value until hydration has restored saved preferences.
4. Set `data-vltd-icon-style="classic"` or `data-vltd-icon-style="friendly-glass"` on `document.documentElement` whenever it changes.
5. Add an **Icon style** section to `src/components/ui/ThemePicker.tsx` with two choices: **Classic** and **Friendly Glass**. This control is independent of Dark/Light and Background.
6. Update only `src/components/ui/AppIcon.tsx` to select the art. Do not import PNGs in individual pages. Preserve the existing outer width/height, className, style, active state, filled state, and `aria-hidden` behavior.
7. Avoid making `AppIcon.tsx` a client component or calling `useTheme()` inside it; it is used broadly by server and client components. A safe approach is to render classic and friendly layers inside the same fixed-size wrapper and let root-attribute CSS show one layer. This keeps theme selection global without forcing client boundaries through the app.
8. For the Friendly layer, render the named PNG with `alt=""`, `aria-hidden="true"`, `width` and `height` equal to the requested icon size, `object-fit: contain`, and no extra padding. For active nav icons, retain the existing active color/opacity treatment on the wrapper; do not create a second set of files.
9. Replace the current placeholder `feature` rendering with the real Friendly Glass image when that style is active. The Classic side of `feature` should keep its current placeholder appearance so switching back is lossless.
10. Keep the current SVG paths and nav renderers intact. Do not delete Classic, `NAV_TOP_CONTENT`, or `NAV_BOTTOM_CONTENT`.

## Trial behavior

- Classic is the production default.
- Friendly Glass changes every `AppIcon` semantic icon from the same global setting, including nav variants, while preserving each existing layout box.
- If a 15-24 px icon becomes unreadable in the real UI, keep the global switch architecture but use Classic automatically below the smallest verified size. Record the exact threshold based on live screenshots; do not make page-by-page exceptions.

## Scope boundaries

- Do not change routes, button actions, labels, navigation, spacing, colors outside the icon wrapper, or any museum 3D code.
- Do not convert decorative illustrations, data visualizations, third-party brand logos, the admin-role badge, barcode scan-target art, museum floor-plan geometry, or editorial cover art. Those were intentionally excluded from the centralized functional icon sweep.
- Do not redesign or regenerate these assets during integration.

## Required verification

1. Programmatically compare `AppIconName` with the 109 files and fail if any name is missing or any extra runtime filename is unmapped.
2. Confirm all 109 URLs return 200 in the production build and the browser has no image 404s.
3. Switch Classic -> Friendly Glass -> Classic from the real Theme Picker. Confirm the visible page updates immediately and the selection survives refresh.
4. Confirm changing Dark/Light or Background does not reset Icon style, and changing Icon style does not reset the background theme.
5. Check desktop and mobile on authenticated surfaces that cover TopNav, BottomNav, Vault, Exhibitions/Museum Builder, Events, Messages, More, Account, and at least one modal with action icons.
6. Confirm no layout shift: buttons, pills, nav bars, and labels keep the same dimensions and alignment in both icon styles.
7. Confirm active/inactive, filled favorite/save states, disabled actions, and loader rotation remain understandable.
8. Check network/performance: only icons used on the current page should load; do not preload all 109 PNGs.
9. Run `tsc --noEmit`, targeted ESLint for changed files, and the production build.
10. Report live visual coverage separately from build/type checks. Do not call it visually approved until EK has reviewed both styles in the actual app.

## Delivery report

Report the commit, deployment status, exact pages and widths visually checked, missing/404 count, persistence result, and any icon names that needed a minimum-size fallback. Do not report unrelated cleanup.
