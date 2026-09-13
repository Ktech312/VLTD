import * as THREE from "three";

import { createGrainTexture, createHardwoodTexture, createStoneFloorTexture } from "./galleryTextures";

export type GalleryFinishStyle = "whitebox" | "vault" | "arcade" | "loft";

interface FinishPalette {
  wallColor: number;
  wallRoughness: number;
  accentColor: number; // the back-wall accent (White's charcoal, Vault/Arcade's own dark accent)
  accentRoughness: number;
  floorColor: number;
  floorRoughness: number;
  floorTreatment: "stone" | "wood" | "concrete";
  jointColor: string; // stone-floor grout line color, ignored for wood floors
  trimColor: number;
  trimMetalness: number;
  trimRoughness: number;
  darkColor: number;
  darkMetalness: number;
  ceilingColor: number;
  glassColor: number;
  glassOpacity: number;
  wallMetalness: number; // 0 = matte plaster/paint, higher = brushed metal
}

// One shared quality bar (material realism, grounded shadows, readable glass,
// distinct trim) applied through three different palettes — Vault and Arcade
// are not White reskinned, they keep their own already-established identity
// (steel/walnut for Vault, dark surfaces + the arcade's own bronze/cyan
// accents for Arcade), just no longer flat and untextured.
const PALETTES: Record<GalleryFinishStyle, FinishPalette> = {
  whitebox: {
    wallColor: 0xe3ddd0, wallRoughness: 0.94, wallMetalness: 0,
    accentColor: 0x454846, accentRoughness: 0.9,
    floorColor: 0xaaa79e, floorRoughness: 0.82, floorTreatment: "stone", jointColor: "#928c7d",
    trimColor: 0xa68b53, trimMetalness: 0.72, trimRoughness: 0.43,
    darkColor: 0x303330, darkMetalness: 0.18,
    ceilingColor: 0xbeb9af,
    glassColor: 0xe6f0ee, glassOpacity: 0.12,
  },
  vault: {
    // 2026-09-06 guarded second pass: the first Vault pass read as "a
    // bright gray utility room," not a secure museum vault — confirmed
    // live via the __vltdDebug hook that White and Vault share the exact
    // same 3 baked wall-wash spotlights (intensity 12 each, present in
    // BOTH styles' GLBs equally), so the difference isn't those — it's
    // that Vault's wall base was much lighter and more reflective
    // (0x9199a1, metalness 0.28) than White's matte plaster, amplifying
    // every light source instead of absorbing it, on top of Vault's own
    // much higher hemi/key/warm ambient (see VirtualGalleryRoom.tsx).
    // Deep gunmetal now instead of pale steel; less metalness so it reads
    // as a brushed/painted panel with weight, not a mirror-bright coating.
    // 2026-09-06, Industrial Loft/Vault refinement handoff, reference image
    // 3 ("dark steel with subtle specular highlights"): roughness nudged
    // down and metalness up slightly from the fourth pass — "increase the
    // metal response modestly," not a return to the old mirror-bright
    // coating this same comment originally moved away from.
    wallColor: 0x4b5158, wallRoughness: 0.48, wallMetalness: 0.24,
    accentColor: 0x2e3237, accentRoughness: 0.46,
    // Dark honed stone gave way to a dedicated "concrete" treatment below
    // (see floorTreatment) per the Industrial Loft/Vault handoff's
    // reference image 3: "polished reflective concrete floor... avoid a
    // tile grid."
    // 2026-09-06, fourth pass: EK's correction — "darken the floor to
    // graphite or nearly black... remove the current pale-gray floor
    // appearance." Cut further than the previous round's charcoal.
    floorColor: 0x17181a, floorRoughness: 0.3, floorTreatment: "concrete", jointColor: "#33363a",
    // Muted aged bronze — lower metalness/higher roughness than before so
    // it reads as brushed hardware catching light locally, not a glowing
    // chrome band running the length of the wall. Darkened and de-shined
    // again in the fourth pass — EK: "reduce the brightness of their brass
    // rims" (the case edge trim reuses this same color/metalness).
    trimColor: 0x83693c, trimMetalness: 0.42, trimRoughness: 0.58,
    // Darker case-base/plinth material too, same pass — EK: "darken the
    // display-case bases."
    darkColor: 0x121416, darkMetalness: 0.3,
    ceilingColor: 0x24272a,
    glassColor: 0xd6dee2, glassOpacity: 0.1,
  },
  // Industrial Loft — EK's ask (2026-09-06 handoff): "the current Vault
  // appearance is liked and must be preserved as a new room style... before
  // Vault is changed further." A deliberate, independent COPY of Vault's
  // palette values as they stood at commit 4f64dff, frozen here on purpose:
  // Vault's own palette above is about to keep evolving (Stage 2 of the same
  // handoff), and this object must NOT drift when that happens, or Loft
  // would silently stop matching the version EK approved. Do not refactor
  // this into a shared reference with `vault` — the whole point is that the
  // two can diverge from here.
  loft: {
    wallColor: 0x4b5158, wallRoughness: 0.58, wallMetalness: 0.16,
    accentColor: 0x2e3237, accentRoughness: 0.55,
    floorColor: 0x17181a, floorRoughness: 0.3, floorTreatment: "stone", jointColor: "#33363a",
    trimColor: 0x83693c, trimMetalness: 0.42, trimRoughness: 0.58,
    darkColor: 0x121416, darkMetalness: 0.3,
    ceilingColor: 0x24272a,
    glassColor: 0xd6dee2, glassOpacity: 0.1,
  },
  arcade: {
    // Dark surfaces + the arcade's own already-established bronze trim and
    // cyan glass (see style_mats() in generate-gallery-room-models.py) —
    // making that identity actually read instead of being washed out by
    // generic bright fill light, not inventing a new color scheme.
    wallColor: 0x1c1626, wallRoughness: 0.68, wallMetalness: 0,
    accentColor: 0x120e19, accentRoughness: 0.62,
    floorColor: 0x140f1d, floorRoughness: 0.5, floorTreatment: "stone", jointColor: "#3c3448",
    trimColor: 0xe0973a, trimMetalness: 0.68, trimRoughness: 0.3,
    darkColor: 0x14101c, darkMetalness: 0.25,
    ceilingColor: 0x140f1d,
    glassColor: 0x8fe6ff, glassOpacity: 0.16,
  },
};

/** Finishes for the existing room styles. No changes to shell or slot geometry. */
export function createGalleryFinishes(style: GalleryFinishStyle = "whitebox") {
  const palette = PALETTES[style];

  // Grayscale, hue-agnostic wall grain — shared with Blue's own hand-coded
  // shell (galleryTextures.ts) so both paths use the one real fine-grain
  // generator instead of a second copy.
  const grain = createGrainTexture();

  let floorTexture: THREE.Texture;
  if (palette.floorTreatment === "wood") {
    // Vault's floor reuses the same walnut-plank texture the fallback shell
    // already uses (createHardwoodTexture in VirtualGalleryRoom.tsx) rather
    // than a second, separately-authored wood texture — one real, detailed
    // wood generator, shared, not duplicated.
    floorTexture = createHardwoodTexture();
  } else if (palette.floorTreatment === "concrete") {
    // Vault refinement handoff (2026-09-06), reference image 3: "dark
    // polished-concrete floor with a smooth sealed finish... subtle
    // concrete tonal variation and large-scale joints... avoid a tile
    // grid." A few soft, irregular tonal blotches (not a per-tile shift)
    // plus one large border join, at a texture repeat scale several times
    // larger than the stone floor above — the whole point is FEWER, BIGGER
    // joints, not the same small-slab pattern in a different color.
    const concreteCanvas = document.createElement("canvas");
    concreteCanvas.width = concreteCanvas.height = 512;
    const concreteCtx = concreteCanvas.getContext("2d")!;
    concreteCtx.drawImage(grain.image as CanvasImageSource, 0, 0);
    let concreteSeed = 4051;
    const concreteRandom = () => ((concreteSeed = (Math.imul(concreteSeed, 1664525) + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 6; i++) {
      const cx = concreteRandom() * 512;
      const cy = concreteRandom() * 512;
      const radius = 90 + concreteRandom() * 130;
      const light = concreteRandom() > 0.5;
      const gradient = concreteCtx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      gradient.addColorStop(0, light ? "rgba(255,255,255,0.035)" : "rgba(6,6,8,0.05)");
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      concreteCtx.fillStyle = gradient;
      concreteCtx.fillRect(0, 0, 512, 512);
    }
    concreteCtx.strokeStyle = palette.jointColor;
    concreteCtx.lineWidth = 2;
    concreteCtx.strokeRect(1, 1, 510, 510);
    const concrete = new THREE.CanvasTexture(concreteCanvas);
    concrete.colorSpace = THREE.SRGBColorSpace;
    concrete.wrapS = concrete.wrapT = THREE.RepeatWrapping;
    // A few times larger than the stone floor's repeat(10.5, 13) — large
    // slabs read as poured concrete bays, not a tile grid.
    concrete.repeat.set(2.5, 3);
    concrete.anisotropy = 8;
    floorTexture = concrete;
  } else {
    // Extracted into galleryTextures.ts's createStoneFloorTexture — the
    // campus room builder now installs the exact same generator for
    // POP_CULTURE's floor instead of a separately-authored one.
    floorTexture = createStoneFloorTexture(palette.jointColor);
  }

  const wall = new THREE.MeshStandardMaterial({
    map: grain, bumpMap: grain, bumpScale: 0.025,
    color: palette.wallColor, roughness: palette.wallRoughness, metalness: palette.wallMetalness,
  });
  const charcoal = new THREE.MeshStandardMaterial({
    map: grain, bumpMap: grain, bumpScale: 0.025,
    color: palette.accentColor, roughness: palette.accentRoughness, metalness: palette.wallMetalness,
  });
  const floor = new THREE.MeshStandardMaterial({
    map: floorTexture,
    bumpMap: palette.floorTreatment === "stone" || palette.floorTreatment === "concrete" ? floorTexture : undefined,
    bumpScale: 0.025,
    color: palette.floorColor, roughness: palette.floorRoughness,
  });
  const brass = new THREE.MeshStandardMaterial({ color: palette.trimColor, metalness: palette.trimMetalness, roughness: palette.trimRoughness });
  const dark = new THREE.MeshStandardMaterial({ color: palette.darkColor, metalness: palette.darkMetalness, roughness: 0.65 });
  // Vault only: "a restrained cool ceiling pattern may help distinguish the
  // room" (design-chat reference brief, 2026-09-06). A quiet geometric grid
  // in a cool blue-gray, not a decorative addition competing with the art
  // below — just enough structure that the ceiling doesn't read as one flat
  // plane, echoing the reference's "cool geometric ceiling light."
  let ceilingTexture: THREE.Texture | undefined;
  // Vault refinement handoff (2026-09-06): the flat painted grid texture is
  // superseded by a real recessed-light grid built as geometry in
  // addVaultArmor below — a texture and actual glowing geometry occupying
  // the same plane would double up/clash. Loft is a frozen snapshot of
  // Vault's PRE-refinement look (commit 4f64dff, painted texture and all),
  // so it alone keeps this exact code path unchanged.
  if (style === "loft") {
    const ceilCanvas = document.createElement("canvas");
    ceilCanvas.width = ceilCanvas.height = 512;
    const ceilCtx = ceilCanvas.getContext("2d")!;
    ceilCtx.fillStyle = "#2c3136";
    ceilCtx.fillRect(0, 0, 512, 512);
    ceilCtx.strokeStyle = "rgba(160,180,196,0.22)";
    ceilCtx.lineWidth = 2;
    const cell = 128;
    for (let i = 0; i <= 512; i += cell) {
      ceilCtx.beginPath();
      ceilCtx.moveTo(i, 0);
      ceilCtx.lineTo(i, 512);
      ceilCtx.stroke();
      ceilCtx.beginPath();
      ceilCtx.moveTo(0, i);
      ceilCtx.lineTo(512, i);
      ceilCtx.stroke();
    }
    ceilingTexture = new THREE.CanvasTexture(ceilCanvas);
    ceilingTexture.colorSpace = THREE.SRGBColorSpace;
    ceilingTexture.wrapS = ceilingTexture.wrapT = THREE.RepeatWrapping;
    ceilingTexture.repeat.set(4, 5);
  }
  const ceiling = new THREE.MeshStandardMaterial({
    map: ceilingTexture, color: ceilingTexture ? 0xffffff : palette.ceilingColor, roughness: 0.98,
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: palette.glassColor, transparent: true, opacity: palette.glassOpacity, roughness: 0.12,
    metalness: 0, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide,
  });
  const finishes = [wall, charcoal, floor, brass, dark, ceiling, glass];
  finishes.forEach((material) => { material.envMapIntensity = 0.35; });
  // Vault refinement handoff, reference image 3: "polished reflective
  // concrete floor" and "dark steel with... controlled environment
  // reflection" — a modest bump over the shared baseline above, on the
  // floor and wall specifically, not every surface (case glass/trim/dark
  // stay at the shared baseline so this reads as two deliberately shinier
  // surfaces, not a general room-wide reflectivity increase).
  if (style === "vault") {
    // FOURTH correction: EK's live review — "the floor look metal now with
    // a giant white light on it... not like the image." The prior bump
    // (0.55->0.62, plus roughness down to 0.18) made the floor reflect the
    // environment map's own bright area as a blown-out hotspot instead of
    // the reference's soft, even sheen. Pulled back below the original
    // baseline, not just back to it.
    floor.envMapIntensity = 0.4;
    wall.envMapIntensity = 0.5;
  }
  const materials: THREE.Material[] = [...finishes];
  const textures: THREE.Texture[] = [grain, floorTexture];
  if (ceilingTexture) textures.push(ceilingTexture);

  function apply(model: THREE.Group) {
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const name = object.name.toLowerCase();
      if (name.includes("floor")) {
        // Replace the baked floor overlay with one continuous surface —
        // but a real, separate floor piece like Vault's own
        // "vault_vestibule_floor" isn't an overlay to hide, it's a real
        // floor with nothing else underneath it. Found live (2026-09-06):
        // this was hiding it outright since it isn't literally named
        // "floor_slab", leaving a gap. Keep anything with "vestibule" in
        // its name visible too.
        object.visible = name === "floor_slab" || name.includes("vestibule");
        object.material = floor;
        if (name === "floor_slab") {
          // World-size UVs keep tiles/planks square and consistently scaled
          // on the original 21 x 26 slab.
          const geometry = object.geometry.clone();
          const position = geometry.getAttribute("position");
          const uv = geometry.getAttribute("uv");
          geometry.computeBoundingBox();
          const bounds = geometry.boundingBox!;
          for (let i = 0; i < uv.count; i++) {
            uv.setXY(i, (position.getX(i) - bounds.min.x) / (bounds.max.x - bounds.min.x),
              (position.getZ(i) - bounds.min.z) / (bounds.max.z - bounds.min.z));
          }
          object.geometry = geometry;
        }
      } else if (name.includes("case_cap")) {
        // A solid lid hides objects viewed from above. The four-sided rim
        // built in addCaseDetails keeps the case's outline while leaving its
        // glass top clear — same fix, now applied to every style's cases,
        // not just White's.
        object.visible = false;
      } else if (name.includes("glass")) {
        object.material = glass;
        object.castShadow = false;
      } else if (name.includes("ceiling")) object.material = ceiling;
      // Vault's case brief (2026-09-06): "case bases need more weight" — a
      // dark stone/steel plinth, not the same pale color as the wall behind
      // it. White/Arcade are untouched (still the wall material, matching
      // their own already-approved look) — this is a Vault-only change.
      else if (name.includes("case_base")) object.material = (style === "vault" || style === "loft") ? dark : wall;
      else if (name.includes("shelf") || name.includes("corner_post") || name.includes("door")) object.material = dark;
      else if (name.includes("wall")) object.material = name === "back_wall" ? charcoal : wall;
      // Design-chat brief (2026-09-06, guarded THIRD pass, reference-image
      // hierarchy): "Remove the continuous gold horizontal accent lines and
      // gold baseboard treatment from Vault... Shelf supports should
      // primarily read as dark steel... brass should catch light locally,
      // not glow across the whole room." Loft only (frozen) keeps this dark
      // treatment. Vault refinement handoff, THIRD correction: matching the
      // wall's color (second correction) still left visible relief lines —
      // these are raised/recessed 3D geometry, not a flat decal, so they
      // keep a shadow edge under the room's directional lights regardless
      // of color. The reference vault door shows no visible internal
      // rail/support-post lines at all, just the seam between two big
      // plates. Rail and stile are decorative trim independent of shelf
      // function (their own y-heights don't even line up with
      // SHELF_ROW_Y), so hiding them outright for Vault is safe — every
      // item's actual position/shelf capacity is untouched, only this
      // baked cosmetic hardware disappears. Shelf boards stay fully
      // visible everywhere (still needed so items read as resting on
      // something). White/Arcade keep their existing brass rail/dark
      // stile, unchanged.
      else if (name.includes("baseboard")) object.material = (style === "vault" || style === "loft") ? dark : brass;
      else if (name.includes("rail")) {
        if (style === "vault") object.visible = false;
        else object.material = style === "loft" ? dark : brass;
      }
      else if (name.includes("stile")) {
        if (style === "vault") object.visible = false;
        else object.material = dark;
      }
      object.receiveShadow = true;
    });
  }

  // Shared 7-point exhibit-pool target table — where every ceiling fixture
  // (visible or hidden) aims, unchanged by the Stage 2 hardware rework
  // below. Index 1 is the back-wall dead-center point that turned out to be
  // the "washed-out central artwork" culprit (see the vaultIntensity note
  // further down).
  const LIGHT_TARGETS: Array<[number, number, number, number, number, number]> = [
    [-6, 8.4, -8.9, -6, 3.7, -12], [0, 8.4, -8.9, 0, 3.7, -12], [6, 8.4, -8.9, 6, 3.7, -12],
    [-7.4, 8.4, -6.5, -10.5, 3.7, -6.5], [-7.4, 8.4, 1.5, -10.5, 3.7, 1.5],
    [7.4, 8.4, -6.5, 10.5, 3.7, -6.5], [7.4, 8.4, 1.5, 10.5, 3.7, 1.5],
  ];

  function addLighting(room: THREE.Group) {
    // Vault refinement handoff (2026-09-06): "remove the extra ceiling-light
    // hardware from Vault: the separate bright white strip, hanging track,
    // and visible spot housings... the grid may be supported by hidden
    // economical lights so artwork remains readable, but it must visually
    // appear to be the light source." Vault gets its own lighting path below
    // with the SAME exhibit-pool targets/intensities but none of the
    // visible fixture geometry — the grid glow built in addVaultArmor is
    // the only visible ceiling hardware now. Loft is a frozen snapshot of
    // Vault's pre-refinement look and keeps the full visible track/spot rig
    // unchanged, same as White.
    if (style === "vault") {
      // FOURTH correction, undoing part of the third: widening the cone to
      // Math.PI/2.6 to blend the pools together made several wide cones
      // overlap directly over the display cases, and EK reported the case
      // flicker coming back — the most likely cause, since nothing else
      // touching lights or shadows changed this round. It also didn't even
      // solve the original complaint: EK's live review still called it
      // "a lot of spot lights... no actual spot light in the room," i.e.
      // still reading as individual lit pools rather than a wash. Fixing
      // both by going the other direction — a much LOWER intensity (so no
      // pool is bright enough to read as "a spotlight" or to visibly
      // overlap-flicker on the cases) plus a moderate, not extreme, cone
      // widening. The ceiling grid and general room fill carry more of the
      // visible light character now, matching "the grid... must visually
      // appear to be the light source."
      LIGHT_TARGETS.forEach(([x, y, z, tx, ty, tz], index) => {
        const vaultIntensity = index === 1 ? 7 : 15;
        const light = new THREE.SpotLight(0xffe6bd, vaultIntensity, 16, Math.PI / 3.6, 1, 1.3);
        light.position.set(x, y - 0.2, z);
        light.target.position.set(tx, ty, tz);
        // EK reported the display cases flickering — the classic cause is a
        // shadow map recomputing every frame against the render loop's own
        // continuous camera lerp (VirtualGalleryRoom.tsx's render() never
        // fully settles, always nudging cameraBody toward its target by a
        // fraction each frame), which reads as shimmer on nearby glass.
        // This was the only shadow-casting light in the scene; turning it
        // off removes that source outright. The visible fixture hardware
        // this light used to help ground is gone anyway in this pass.
        room.add(light, light.target);
      });
      const doorLight = new THREE.SpotLight(0xf3ead2, 22, 9, Math.PI / 6, 0.6, 1.3);
      doorLight.position.set(-3.2, 4.2, 4.4);
      doorLight.target.position.set(0, 2.2, 5.5);
      room.add(doorLight, doorLight.target);
      return;
    }

    const fixture = new THREE.MeshStandardMaterial({ color: 0x242623, roughness: 0.5, metalness: 0.6 });
    const lens = new THREE.MeshBasicMaterial({ color: 0xffedcf, toneMapped: false });
    materials.push(fixture, lens);
    const box = (w: number, h: number, d: number, x: number, y: number, z: number) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), fixture);
      mesh.position.set(x, y, z);
      room.add(mesh);
    };
    box(17.2, 0.1, 0.12, 0, 8.65, -8.9);
    box(0.12, 0.1, 15, -7.4, 8.65, -1.6);
    box(0.12, 0.1, 15, 7.4, 8.65, -1.6);
    LIGHT_TARGETS.forEach(([x, y, z, tx, ty, tz], index) => {
      const direction = new THREE.Vector3(tx - x, ty - y, tz - z).normalize();
      const head = new THREE.Group();
      head.position.set(x, y, z);
      head.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), direction);
      head.add(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.42, 16), fixture));
      const face = new THREE.Mesh(new THREE.CircleGeometry(0.105, 16), lens);
      face.rotation.x = Math.PI / 2;
      face.position.y = -0.215;
      head.add(face);
      room.add(head);
      box(0.055, 0.24, 0.055, x, 8.55, z);
      // Wider cone + higher penumbra than a "spot on a wall" needs on their
      // own — deliberately so neighboring pools soften into each other
      // instead of leaving a visible dark seam between fixtures, and so no
      // single pool reads as a hard circular stamp. Intensity/distance/decay
      // are untouched: this broadens each pool's edge, it doesn't add light.
      // Loft-only cut (frozen from Vault's own fourth pass, 2026-09-06):
      // this same rig at White's full 55 was the actual source of EK's
      // "washed-out central artwork" call-out — index 1's target sits
      // exactly on the back-wall center (x=0, z=-12), dead-on and
      // perpendicular to that piece's glass, which reads as a blown-out
      // glare hotspot rather than even illumination. White keeps 55
      // everywhere (already reviewed/approved).
      const vaultIntensity = index === 1 ? 14 : 30;
      const light = new THREE.SpotLight(0xffe6bd, style === "loft" ? vaultIntensity : 55, 16, Math.PI / 4.6, 0.88, 1.25);
      light.position.set(x, y - 0.2, z);
      light.target.position.set(tx, ty, tz);
      // Only the central beam needs a shadow map: keep mobile fill cost bounded.
      // Loft correction: EK confirmed the same shadow-map flicker (fixed in
      // Vault by dropping this light's shadow entirely) shows up in
      // Industrial Loft too, on the same light in the same shared render
      // loop — same root cause, same fix, scoped to loft only (not
      // touching whitebox, which hasn't been reported).
      light.castShadow = index === 1 && style !== "loft";
      if (light.castShadow) {
        light.shadow.mapSize.set(1024, 1024);
        light.shadow.bias = -0.0002;
        light.shadow.normalBias = 0.035;
      }
      room.add(light, light.target);
    });

    // Loft only (frozen from Vault): a dedicated angled side light on the
    // door/arch assembly (the real GLB geometry sits roughly x=0,
    // z≈5.2-5.7 — see "vault_plate_top"/"vault_left_post"/
    // "vault_right_post" positions, confirmed live via __vltdDebug). One
    // modest, non-shadow-casting spot, not a second full fixture rig.
    if (style === "loft") {
      const doorLight = new THREE.SpotLight(0xf3ead2, 22, 9, Math.PI / 6, 0.6, 1.3);
      doorLight.position.set(-3.2, 4.2, 4.4);
      doorLight.target.position.set(0, 2.2, 5.5);
      room.add(doorLight, doorLight.target);
    }
  }
  function addCaseDetails(room: THREE.Group, spots: Array<[number, number]>) {
    const edgeMaterial = new THREE.LineBasicMaterial({ color: palette.trimColor, transparent: true, opacity: 0.6 });
    materials.push(edgeMaterial);
    // Cheap fake contact shadow: a soft radial-gradient decal on the floor
    // under each case, instead of a real shadow-casting light per case.
    // Without this the cases' plinths read as floating just above the floor,
    // since nothing else in the scene darkens the floor directly beneath them.
    const shadowCanvas = document.createElement("canvas");
    shadowCanvas.width = shadowCanvas.height = 128;
    const shadowCtx = shadowCanvas.getContext("2d")!;
    const gradient = shadowCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, "rgba(20,18,14,0.42)");
    gradient.addColorStop(0.7, "rgba(20,18,14,0.22)");
    gradient.addColorStop(1, "rgba(20,18,14,0)");
    shadowCtx.fillStyle = gradient;
    shadowCtx.fillRect(0, 0, 128, 128);
    const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
    shadowTexture.colorSpace = THREE.SRGBColorSpace;
    textures.push(shadowTexture);
    const shadowMaterial = new THREE.MeshBasicMaterial({
      map: shadowTexture, transparent: true, depthWrite: false, toneMapped: false,
    });
    materials.push(shadowMaterial);
    spots.forEach(([x, z]) => {
      const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2, 1.7), shadowMaterial);
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.set(x, 0.006, z);
      room.add(shadow);
      const box = new THREE.BoxGeometry(1.3, 1.15, 1);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box), edgeMaterial);
      box.dispose();
      edges.position.set(x, 1.25, z);
      room.add(edges);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.08, 1.02), dark);
      foot.position.set(x, 0.045, z);
      room.add(foot);
      for (const side of [-1, 1]) {
        const across = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.04, 0.035), brass);
        across.position.set(x, 1.835, z + side * 0.535);
        const along = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.04, 1.1), brass);
        along.position.set(x + side * 0.6925, 1.835, z);
        room.add(across, along);
      }
    });
  }
  // Vault only: a genuine architectural pass, not another material swap.
  // EK's direct correction (2026-09-06, third round): "it still looks like
  // the original gallery with different colors... make a clearly visible
  // Vault-specific architectural pass." Adds real geometry — protruding
  // steel ribs, a recessed seam replacing the old rail's position, rivets,
  // a recessed-bay outline framing each shelf wall, and a glowing
  // geometric ceiling-light pattern (the reference image's actual neon
  // lines, not a painted texture, since the ceiling texture from the prior
  // round apparently wasn't "immediately obvious" from the entrance).
  // Every shelf/slot/item position, the door's shape, and the room's
  // dimensions are untouched — this is decorative geometry layered onto
  // the existing shell, the same additive pattern as addCaseDetails'
  // contact shadows.
  function addVaultArmor(room: THREE.Group) {
    if (style === "loft") {
      addLoftArmor(room);
      return;
    }
    addVaultArmorRefined(room);
  }

  // Frozen, verbatim copy of Vault's fourth-pass armor geometry as it stood
  // at commit 4f64dff — Industrial Loft's own independent copy (2026-09-06
  // handoff) so it keeps EK's approved look no matter how addVaultArmorRefined
  // below keeps changing for Vault itself. Do not edit this function when
  // refining Vault; edit addVaultArmorRefined instead.
  function addLoftArmor(room: THREE.Group) {
    const ribMaterial = new THREE.MeshStandardMaterial({ color: 0x24272a, metalness: 0.32, roughness: 0.52 });
    const dividerMaterial = new THREE.MeshStandardMaterial({ color: 0x1c1e20, metalness: 0.3, roughness: 0.55 });
    const seamMaterial = new THREE.MeshStandardMaterial({ color: 0x121314, metalness: 0.2, roughness: 0.65 });
    const rivetMaterial = new THREE.MeshStandardMaterial({ color: 0x767c81, metalness: 0.68, roughness: 0.4 });
    const bayEdgeMaterial = new THREE.LineBasicMaterial({ color: 0x45494d, transparent: true, opacity: 0.5 });
    materials.push(ribMaterial, dividerMaterial, seamMaterial, rivetMaterial, bayEdgeMaterial);

    const WALL_TOP = 8.9;
    const WALL_BOTTOM = 0.25;
    const RIB_DEPTH = 0.08;
    const SEAM_Y = 6.6;

    // Shallow structural ribs — fewer and slightly wider than the third
    // pass ("large armored panels", not many thin scattered lines). A
    // rivet sits only where a rib actually crosses the horizontal seam —
    // one believable fastener per junction, not two arbitrary dots.
    function addWallRibs(wallAxis: "x" | "z", fixedCoord: number, faceSign: 1 | -1, positions: number[]) {
      for (const pos of positions) {
        const rib = new THREE.Mesh(
          wallAxis === "x"
            ? new THREE.BoxGeometry(0.16, WALL_TOP - WALL_BOTTOM, RIB_DEPTH)
            : new THREE.BoxGeometry(RIB_DEPTH, WALL_TOP - WALL_BOTTOM, 0.16),
          ribMaterial
        );
        const midY = (WALL_TOP + WALL_BOTTOM) / 2;
        if (wallAxis === "x") rib.position.set(pos, midY, fixedCoord + faceSign * RIB_DEPTH * 0.5);
        else rib.position.set(fixedCoord + faceSign * RIB_DEPTH * 0.5, midY, pos);
        room.add(rib);
        const rivet = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.06, 10), rivetMaterial);
        rivet.rotation.x = wallAxis === "x" ? Math.PI / 2 : 0;
        rivet.rotation.z = wallAxis === "x" ? 0 : Math.PI / 2;
        if (wallAxis === "x") rivet.position.set(pos, SEAM_Y, fixedCoord + faceSign * (RIB_DEPTH + 0.035));
        else rivet.position.set(fixedCoord + faceSign * (RIB_DEPTH + 0.035), SEAM_Y, pos);
        room.add(rivet);
      }
    }
    addWallRibs("x", -12, 1, [-7.5, -2.5, 2.5, 7.5]);
    addWallRibs("z", -10.5, 1, [-11, -6, -1, 4]);
    addWallRibs("z", 10.5, -1, [-11, -6, -1, 4]);

    // The recessed seam replacing the old bright rail's position — kept
    // from the third pass, unchanged.
    function addSeam(wallAxis: "x" | "z", fixedCoord: number, faceSign: 1 | -1, span: [number, number]) {
      const length = span[1] - span[0];
      const mid = (span[0] + span[1]) / 2;
      const seam = new THREE.Mesh(
        wallAxis === "x" ? new THREE.BoxGeometry(length, 0.05, 0.03) : new THREE.BoxGeometry(0.03, 0.05, length),
        seamMaterial
      );
      if (wallAxis === "x") seam.position.set(mid, SEAM_Y, fixedCoord + faceSign * 0.02);
      else seam.position.set(fixedCoord + faceSign * 0.02, SEAM_Y, mid);
      room.add(seam);
    }
    addSeam("x", -12, 1, [-9.8, 9.8]);
    addSeam("z", -10.5, 1, [-14.5, 8.5]);
    addSeam("z", 10.5, -1, [-14.5, 8.5]);

    // A FEW broad recessed display bays, not one long outline across a
    // flat wall — EK: "organize the back wall into a few broad recessed
    // display bays." A wide divider panel splits each wall into 2-3
    // sections; each section gets its own bay outline. Every shelf/item
    // position underneath is completely untouched — these bays are simply
    // drawn around the existing layout, not built to move it.
    function addBayOutline(wallAxis: "x" | "z", fixedCoord: number, faceSign: 1 | -1, span: [number, number]) {
      const length = span[1] - span[0];
      const mid = (span[0] + span[1]) / 2;
      const height = 4.5;
      const midY = 3.4;
      const box =
        wallAxis === "x" ? new THREE.BoxGeometry(length, height, 0.02) : new THREE.BoxGeometry(0.02, height, length);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box), bayEdgeMaterial);
      box.dispose();
      if (wallAxis === "x") edges.position.set(mid, midY, fixedCoord + faceSign * 0.05);
      else edges.position.set(fixedCoord + faceSign * 0.05, midY, mid);
      room.add(edges);
    }
    function addDivider(wallAxis: "x" | "z", fixedCoord: number, faceSign: 1 | -1, pos: number) {
      const divider = new THREE.Mesh(
        wallAxis === "x"
          ? new THREE.BoxGeometry(0.32, WALL_TOP - WALL_BOTTOM, RIB_DEPTH + 0.04)
          : new THREE.BoxGeometry(RIB_DEPTH + 0.04, WALL_TOP - WALL_BOTTOM, 0.32),
        dividerMaterial
      );
      const midY = (WALL_TOP + WALL_BOTTOM) / 2;
      if (wallAxis === "x") divider.position.set(pos, midY, fixedCoord + faceSign * (RIB_DEPTH + 0.04) * 0.5);
      else divider.position.set(fixedCoord + faceSign * (RIB_DEPTH + 0.04) * 0.5, midY, pos);
      room.add(divider);
    }
    // Back wall: 2 dividers → 3 bays.
    addDivider("x", -12, 1, -3.3);
    addDivider("x", -12, 1, 3.3);
    addBayOutline("x", -12, 1, [-9.5, -3.6]);
    addBayOutline("x", -12, 1, [-3, 3]);
    addBayOutline("x", -12, 1, [3.6, 9.5]);
    // Side walls: 1 divider → 2 bays each.
    addDivider("z", -10.5, 1, -3);
    addBayOutline("z", -10.5, 1, [-14, -3.3]);
    addBayOutline("z", -10.5, 1, [-2.7, 8]);
    addDivider("z", 10.5, -1, -3);
    addBayOutline("z", 10.5, -1, [-14, -3.3]);
    addBayOutline("z", 10.5, -1, [-2.7, 8]);

    // Deeper wall returns flanking the existing archway (unchanged from
    // the third pass) — the arch's own shape/position stays exactly as
    // is; EK's explicit correction this round: it stays a secondary
    // passage, not the main vault door.
    for (const side of [-1, 1]) {
      const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6.4, 0.4), ribMaterial);
      jamb.position.set(side * 2.35, 3.4, 5.5);
      room.add(jamb);
    }

    // Ceiling light, redone per EK's explicit correction: "reduce the
    // brightness substantially... from vivid neon cyan to a restrained
    // icy blue-white... recess the lines into dark ceiling channels...
    // fewer, longer connected lines positioned far enough inside the room
    // to remain readable." One connected 3-point path (not scattered
    // separate zigzags), routed well inside the room (z from -10 to -4,
    // clear of the entrance edge where the third pass's fragments got
    // clipped), each segment sunk into a wider dark recessed channel box
    // so the light reads as coming FROM the ceiling, not floating in
    // front of it. Point-light intensity cut hard (2.2→0.3) — that spill
    // was very likely a real contributor to "washed-out central artwork,"
    // on top of it just being too much light for a "restrained" fixture.
    const glowMaterial = new THREE.MeshBasicMaterial({ color: 0xcfe1e8, toneMapped: false });
    const channelMaterial = new THREE.MeshStandardMaterial({ color: 0x101214, roughness: 0.8, metalness: 0.1 });
    materials.push(glowMaterial, channelMaterial);
    function glowSegment(x1: number, z1: number, x2: number, z2: number) {
      const dx = x2 - x1;
      const dz = z2 - z1;
      const length = Math.sqrt(dx * dx + dz * dz);
      const angle = -Math.atan2(dz, dx);
      const channel = new THREE.Mesh(new THREE.BoxGeometry(length + 0.3, 0.1, 0.32), channelMaterial);
      channel.position.set((x1 + x2) / 2, 8.78, (z1 + z2) / 2);
      channel.rotation.y = angle;
      room.add(channel);
      const line = new THREE.Mesh(new THREE.BoxGeometry(length, 0.05, 0.1), glowMaterial);
      line.position.set((x1 + x2) / 2, 8.74, (z1 + z2) / 2);
      line.rotation.y = angle;
      room.add(line);
    }
    // EK's ask (Industrial Loft follow-up, 2026-09-06): "you have this...
    // Arrow light bar, but only one... can you do 4, each one facing a
    // different wall like the existing one is now?" The original bent
    // 2-segment path is a chevron whose vertex points at the back wall,
    // arms opening toward the room's center. addArrow reproduces that same
    // vertex+2-arms shape, then places one copy aimed at each of the 4
    // walls (back, front, left, right) by rotating which axis the vertex
    // sits furthest along.
    function addArrow(vertex: [number, number], arm1: [number, number], arm2: [number, number]) {
      glowSegment(vertex[0], vertex[1], arm1[0], arm1[1]);
      glowSegment(vertex[0], vertex[1], arm2[0], arm2[1]);
      const light = new THREE.PointLight(0xcfe1e8, 0.22, 7, 1.4);
      light.position.set(vertex[0], 8.5, vertex[1]);
      room.add(light);
    }
    addArrow([0, -9], [-4, -5], [4, -5]); // points at the back wall
    addArrow([0, 2], [-4, -2], [4, -2]); // points at the front/entrance wall
    addArrow([-8, -3], [-4, -7], [-4, 1]); // points at the left wall
    addArrow([8, -3], [4, -7], [4, 1]); // points at the right wall
  }

  // Vault refinement handoff (2026-09-06) — SECOND correction after EK's
  // live review of the first attempt found it still didn't match the
  // reference image: walls read as a busy grid of many thin ribs/seams
  // instead of large steel panels with corner bolts, and the ceiling grid
  // was rebuilt from scratch as an axis-aligned lattice in a pale near-
  // white color instead of enhancing the room's existing DIAGONAL glow
  // path in a clearly saturated blue like the reference. This version
  // fixes both directly against the reference image rather than the
  // earlier (wrong) reading of the text brief.
  function addVaultArmorRefined(room: THREE.Group) {
    const dividerMaterial = new THREE.MeshStandardMaterial({ color: 0x1c1e20, metalness: 0.3, roughness: 0.55 });
    const rivetMaterial = new THREE.MeshStandardMaterial({ color: 0x8a9096, metalness: 0.72, roughness: 0.35 });
    materials.push(dividerMaterial, rivetMaterial);

    const WALL_TOP = 8.9;
    const WALL_BOTTOM = 0.25;
    const RIVET_INSET = 0.4;

    // Large steel panels, floor to ceiling, with a bolt near each of the 4
    // corners — the reference image's vault-door look, not a grid of many
    // thin ribs and a horizontal seam. EK's direct correction: "they
    // should be large rectangle panels with rivets in the corners from
    // floor to ceiling."
    function addPanelCorners(wallAxis: "x" | "z", fixedCoord: number, faceSign: 1 | -1, span: [number, number]) {
      const [a, b] = span;
      for (const pos of [a + RIVET_INSET, b - RIVET_INSET]) {
        for (const y of [WALL_TOP - RIVET_INSET, WALL_BOTTOM + RIVET_INSET]) {
          const rivet = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 10), rivetMaterial);
          rivet.rotation.x = wallAxis === "x" ? Math.PI / 2 : 0;
          rivet.rotation.z = wallAxis === "x" ? 0 : Math.PI / 2;
          if (wallAxis === "x") rivet.position.set(pos, y, fixedCoord + faceSign * 0.035);
          else rivet.position.set(fixedCoord + faceSign * 0.035, y, pos);
          room.add(rivet);
        }
      }
    }
    // A single divider between adjacent panels reads as the seam where two
    // large plates meet — the room's actual panel organization, not a
    // decorative frame. THIRD correction: EK's direct ask — "make their
    // seams much thinner. Use narrow recessed joints" — cut from a 0.3-wide
    // slab (itself read as another thick line) down to a genuinely narrow
    // groove.
    function addDivider(wallAxis: "x" | "z", fixedCoord: number, faceSign: 1 | -1, pos: number) {
      const divider = new THREE.Mesh(
        wallAxis === "x"
          ? new THREE.BoxGeometry(0.07, WALL_TOP - WALL_BOTTOM, 0.06)
          : new THREE.BoxGeometry(0.06, WALL_TOP - WALL_BOTTOM, 0.07),
        dividerMaterial
      );
      const midY = (WALL_TOP + WALL_BOTTOM) / 2;
      if (wallAxis === "x") divider.position.set(pos, midY, fixedCoord + faceSign * 0.04);
      else divider.position.set(fixedCoord + faceSign * 0.04, midY, pos);
      room.add(divider);
    }
    // FOURTH correction: EK's direct count — "you only made two on each
    // wall and didn't leave the 4 on each wall." 3 dividers -> 4 equal
    // panels, back wall and both side walls alike.
    for (const pos of [-4.9, 0, 4.9]) addDivider("x", -12, 1, pos);
    addPanelCorners("x", -12, 1, [-9.8, -4.9]);
    addPanelCorners("x", -12, 1, [-4.9, 0]);
    addPanelCorners("x", -12, 1, [0, 4.9]);
    addPanelCorners("x", -12, 1, [4.9, 9.8]);
    for (const pos of [-8.75, -3, 2.75]) addDivider("z", -10.5, 1, pos);
    addPanelCorners("z", -10.5, 1, [-14.5, -8.75]);
    addPanelCorners("z", -10.5, 1, [-8.75, -3]);
    addPanelCorners("z", -10.5, 1, [-3, 2.75]);
    addPanelCorners("z", -10.5, 1, [2.75, 8.5]);
    for (const pos of [-8.75, -3, 2.75]) addDivider("z", 10.5, -1, pos);
    addPanelCorners("z", 10.5, -1, [-14.5, -8.75]);
    addPanelCorners("z", 10.5, -1, [-8.75, -3]);
    addPanelCorners("z", 10.5, -1, [-3, 2.75]);
    addPanelCorners("z", 10.5, -1, [2.75, 8.5]);

    // The two jamb boxes that used to flank the archway here are REMOVED —
    // EK's direct correction, third round, pointing at a live screenshot:
    // "two thick black pillars in front of the arched passage... remove
    // them completely. They obscure the existing metal surround and have
    // no useful visual purpose. Do not replace them with another
    // foreground frame." The GLB's own baked arch/door assembly
    // ("vault_door_anchor") already has its own real surround — these
    // boxes were redundant armor sitting in front of it, not structural.

    // Ceiling grid — THIRD correction, fixed IN PLACE per EK's explicit
    // instruction ("keep the existing ceiling-grid geometry and correct it
    // in place, do not delete it and construct another replacement"). Two
    // real problems with the prior version, both fixed without touching
    // the overall diagonal-lattice concept:
    // 1. Endpoints were arbitrary interior points, not real boundaries —
    //    "every illuminated line must span from one ceiling boundary to
    //    another." Recomputed the same 6-line diamond lattice so each line
    //    starts and ends exactly on a real wall (left x=-10.5, right
    //    x=10.5, back z=-12, front z=7 — the front wall's own real
    //    position). No line floats mid-ceiling anymore.
    // 2. The single flat-color line sitting inside a WIDER, taller,
    //    OVERHANGING channel (length+0.3, hanging 0.37 below the actual
    //    9.15 ceiling plane) read as "protruding dark backing rail" / a
    //    hanging fluorescent tube, not a recessed light. Channel now sits
    //    flush against the ceiling (y=9.08, just 0.07 below the true
    //    ceiling plane) and is sized to the line's own length, no overhang.
    //    FOURTH correction: the previous version's bright near-white core
    //    inside the blue glow read as an unexplained "white line in the
    //    middle of the blue lights," not an intentional highlight. Both
    //    layers are now the SAME blue hue — a more opaque core plus a
    //    softer, wider, transparent glow of that identical color for the
    //    edge falloff — never a different color.
    const coreMaterial = new THREE.MeshBasicMaterial({ color: 0x38d2f2, toneMapped: false });
    const edgeGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0x38d2f2, transparent: true, opacity: 0.4, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false,
    });
    const channelMaterial = new THREE.MeshStandardMaterial({ color: 0x0c0e10, roughness: 0.85, metalness: 0.1 });
    materials.push(coreMaterial, edgeGlowMaterial, channelMaterial);
    function glowSegment(x1: number, z1: number, x2: number, z2: number) {
      const dx = x2 - x1;
      const dz = z2 - z1;
      const length = Math.sqrt(dx * dx + dz * dz);
      const angle = -Math.atan2(dz, dx);
      const midX = (x1 + x2) / 2;
      const midZ = (z1 + z2) / 2;
      const channel = new THREE.Mesh(new THREE.BoxGeometry(length, 0.04, 0.26), channelMaterial);
      channel.position.set(midX, 9.08, midZ);
      channel.rotation.y = angle;
      room.add(channel);
      const edge = new THREE.Mesh(new THREE.BoxGeometry(length, 0.03, 0.2), edgeGlowMaterial);
      edge.position.set(midX, 9.06, midZ);
      edge.rotation.y = angle;
      room.add(edge);
      const core = new THREE.Mesh(new THREE.BoxGeometry(length, 0.02, 0.06), coreMaterial);
      core.position.set(midX, 9.055, midZ);
      core.rotation.y = angle;
      room.add(core);
    }
    // Diamond lattice, every line running wall to wall: 3 rising
    // left-to-right, 3 falling left-to-right, crossing at 6 real
    // intersections inside the room.
    glowSegment(-4, -12, 10.5, 2.5); // back wall -> right wall
    glowSegment(-10, -12, 9, 7); // back wall -> front wall
    glowSegment(-10.5, -6.5, 3, 7); // left wall -> front wall
    glowSegment(-10.5, 2.5, 4, -12); // left wall -> back wall
    glowSegment(-9, 7, 10, -12); // front wall -> back wall
    glowSegment(-3, 7, 10.5, -6.5); // front wall -> right wall
    // Restrained fill so the grid reads as the light source without
    // spilling onto nearby artwork.
    const glow = new THREE.PointLight(0x38d2f2, 0.4, 9, 1.4);
    glow.position.set(-1, 8.9, -6);
    room.add(glow);
  }

  // Vault-style full-parity pass (2026-09-12): `glass` added to this return
  // object — narrowly additive, same as the prior pass's ceiling/charcoal
  // addition above — so museumRoomFurniture.ts's buildDisplayCase() can
  // reuse this style's own real glass material for museum display cases
  // instead of one fixed color/opacity for every style. No existing
  // property, behavior, or caller is changed.
  return { wall, floor, ceiling, brass, charcoal, dark, glass, apply, addLighting, addCaseDetails, addVaultArmor, dispose() {
    textures.forEach((texture) => texture.dispose());
    materials.forEach((material) => material.dispose());
  } };
}
