# VLTD Grand Hall visual package

This package defines the custom visual direction for the Grand Hall. It is a design handoff only; no application code is changed by this package.

## Approved direction

- A long central glass skylight above the Hall's center axis.
- Deep coffered ceiling bays around the skylight with warm concealed light.
- Warm ivory limestone walls with dark bronze shadow joints.
- Large-format warm ivory marble flooring with restrained gray and faint gold veining.
- Charcoal marble perimeter border with thin aged-brass inlay.
- Restore `public/brand/vltd-museum-floor-medallion-v1.png` at the exact center of the floor.
- Preserve every existing doorway, sign, target, room dimension, camera, movement, and adjoining room.

## Asset files

- `public/museum/grand-hall/grand-hall-concept-v1.png`: architectural appearance and lighting reference.
- `public/museum/grand-hall/grand-hall-ceiling-concept-v1.png`: straight-up construction reference for the skylight, coffers, trim, and concealed lighting.
- `public/museum/grand-hall/warm-ivory-marble-basecolor.png`: Grand Hall floor field.
- `public/museum/grand-hall/warm-ivory-marble-roughness.png`
- `public/museum/grand-hall/warm-ivory-marble-normal.png`
- `public/museum/grand-hall/ivory-limestone-basecolor.png`: Grand Hall walls.
- `public/museum/grand-hall/ivory-limestone-roughness.png`
- `public/museum/grand-hall/ivory-limestone-normal.png`
- `public/museum/grand-hall/charcoal-marble-basecolor.png`: floor border and wall base trim.
- `public/museum/grand-hall/charcoal-marble-roughness.png`
- `public/museum/grand-hall/charcoal-marble-normal.png`
- `public/museum/grand-hall/warm-ivory-plaster-basecolor.png`: coffered ceiling surfaces.
- `public/museum/grand-hall/warm-ivory-plaster-roughness.png`
- `public/museum/grand-hall/warm-ivory-plaster-normal.png`

## Material intent

- Marble floor: controlled low gloss, never mirror-like. Start near roughness 0.34-0.40 and adjust under the final lighting.
- Limestone walls: honed and diffuse. Start near roughness 0.68-0.78.
- Charcoal marble: restrained satin finish. Start near roughness 0.36-0.44.
- Ceiling plaster: matte. Start near roughness 0.75-0.85.
- Normal maps are intentionally subtle and should not make the surfaces look carved or damaged.

## Geometry and lighting

- The skylight and coffers must be modeled as geometry. Do not apply the concept image to the ceiling.
- Use `grand-hall-ceiling-concept-v1.png` to build a long rectangular skylight centered over the Hall. The glass field should occupy roughly 45-55% of the Hall length and 30-38% of its width, adjusted only as needed to preserve the real room proportions and doorway axes.
- Give the skylight a substantial framed curb and a dark bronze mullion grid. It should read as an architectural opening with depth, not a bright rectangle placed on the ceiling.
- Build a symmetrical perimeter of large, deep coffers around all four sides. Keep the bays broad and calm; avoid a dense grid of small ceiling tiles.
- Recess the warm light source inside the coffer edges and around the skylight curb so the glow is visible without exposing a continuous flat light panel.
- Divide the coffer layout symmetrically around the existing Hall centerline and real doorway locations.
- Use emissive strips for the visible coffer glow, supported by a limited number of soft area/rect lights.
- Combine soft cool skylight illumination with warm 2700-3000K coffer lighting and restrained wall washing.
- Keep the VLTD medallion fully visible and let the existing enlarged center target frame it without covering it.

## Review views

Check the result from the main entrance, every interior doorway, all four corners, and the room center. The skylight, ceiling grid, floor border, and medallion must remain centered and symmetrical from all approaches.
