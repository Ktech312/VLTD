# Generation notes

## Visual direction

Friendly, dimensional glass tiles for a younger and more approachable VLTD interface while retaining the app's black, gold, cyan, violet, coral, and green identity. Icons use rounded forms, glossy depth, strong silhouettes, luminous edges, and a dark translucent tile.

## Production method

The artwork was generated as seven strict 4 x 4 sheets, one semantic icon per cell in row-major order. Backgrounds were exported or mechanically corrected to true alpha transparency, then each cell was packaged as a named 256 x 256 PNG. The source sheets remain in `sheets/`; the runtime-ready files are in `icons/`.

## Core generation prompt

Create a strict 4 by 4 grid of sixteen separate app icons with no text or labels. Use a cohesive premium but approachable 3D glassmorphism style: rounded black translucent glass tiles, glossy dimensional symbols, luminous gold, cyan, violet, coral, and green accents, soft internal reflections, clear silhouettes, friendly proportions, consistent camera and lighting, and enough spacing that every cell can be cropped independently. Output a true transparent RGBA PNG. Do not draw a checkerboard, background, border, watermark, letters, or captions.

## Limitation

This is an approved visual trial pack, not a final hand-drawn production set. Review it in the real app through the global style switch before replacing the Classic default.

