import * as THREE from "three";

// Shared, dependency-free texture generators used by both VirtualGalleryRoom.tsx
// (the fallback shell, and Blue's own hand-coded shell) and galleryRoomFinishes.ts
// (Vault's real floor). Kept in their own module specifically so neither of
// those two files needs to import from the other — VirtualGalleryRoom.tsx
// already imports createGalleryFinishes from galleryRoomFinishes.ts, so the
// reverse import would be circular.

export function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Lightens (positive amt) or darkens (negative amt) a hex color by a
// fraction of the distance to white/black — used to build each plank's own
// gradient from its randomly-picked base tone instead of one shared gradient.
export function shadeHex(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const mix = (channel: number) => {
    const target = amt >= 0 ? 255 : 0;
    return Math.round(channel + (target - channel) * Math.abs(amt));
  };
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}

// A grayscale, hue-agnostic multiplicative detail layer — the same texture
// works under any material's own `color`, since Three.js multiplies map
// against color in the shader. Two high-frequency wave layers (periods of a
// few pixels, many cycles across the 512px canvas) read as fine mineral/
// paint grain, never as a repeating blob — that's what a single
// low-frequency sine pair produced in an earlier pass (~1-2 cycles across
// the whole canvas, tiled 5x3 across a wall, so it read as fuzzy fabric/
// clouds at real viewing distance). One very-low-frequency term is kept, but
// at low amplitude and a period longer than the canvas itself, so within any
// one tile it's only a gentle overall drift, not a visible blob.
export function createGrainTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  let seed = 47;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const pixels = ctx.createImageData(512, 512);
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const i = (y * 512 + x) * 4;
      const grain = Math.sin(x * 0.85 + y * 0.31) * 1.1 + Math.sin(x * 0.22 - y * 0.57) * 0.9;
      const drift = Math.sin(x / 240 + y / 300) * 1.4;
      const tone = 217 + grain + drift + (random() - 0.5) * 8;
      pixels.data.set([tone, tone - 3, tone - 8, 255], i);
    }
  }
  ctx.putImageData(pixels, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 3);
  texture.anisotropy = 4;
  return texture;
}

export function createHardwoodTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 768;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const rand = mulberry32(20260815);
  const plankHeight = 64;
  // A deep walnut palette (was a flatter, more saturated rust-orange that
  // read as plastic under render) — every plank below picks its own base
  // tone from this set rather than every row sharing one identical
  // gradient, which is what made the old floor look like a single tiled
  // sprite instead of individual boards.
  const tones = ["#4a3120", "#573823", "#3f2a1b", "#5c3d26", "#48301f", "#63432b"];

  ctx.fillStyle = "#3f2a1b";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < canvas.height; y += plankHeight) {
    let x = -Math.floor(rand() * 140);
    while (x < canvas.width) {
      const plankLength = 130 + rand() * 130;
      const base = tones[Math.floor(rand() * tones.length)];
      const grd = ctx.createLinearGradient(0, y, 0, y + plankHeight);
      grd.addColorStop(0, shadeHex(base, 0.16));
      grd.addColorStop(0.5, base);
      grd.addColorStop(1, shadeHex(base, -0.12));
      ctx.fillStyle = grd;
      ctx.fillRect(x, y, plankLength, plankHeight);

      // End-seam and long-edge lines around this specific board.
      ctx.strokeStyle = "rgba(18,9,4,0.55)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y + 0.75, plankLength, plankHeight - 1.5);

      // A little brightness jitter per board so neighbors read as distinct
      // pieces of wood, not one repeating swatch.
      ctx.fillStyle = `rgba(255,235,205,${rand() * 0.05})`;
      ctx.fillRect(x, y, plankLength, plankHeight);

      x += plankLength;
    }
  }

  for (let i = 0; i < 220; i += 1) {
    const x = rand() * canvas.width;
    const y = rand() * canvas.height;
    const length = 20 + rand() * 70;
    ctx.strokeStyle = `rgba(255,220,165,${0.04 + rand() * 0.07})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + length * 0.32, y - 6, x + length * 0.68, y + 6, x + length, y);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 4.4);
  texture.anisotropy = 8;
  return texture;
}
