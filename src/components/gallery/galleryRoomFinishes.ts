import * as THREE from "three";

import { createGrainTexture, createHardwoodTexture } from "./galleryTextures";

export type GalleryFinishStyle = "whitebox" | "vault" | "arcade";

interface FinishPalette {
  wallColor: number;
  wallRoughness: number;
  accentColor: number; // the back-wall accent (White's charcoal, Vault/Arcade's own dark accent)
  accentRoughness: number;
  floorColor: number;
  floorRoughness: number;
  floorTreatment: "stone" | "wood";
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
    wallColor: 0x4b5158, wallRoughness: 0.58, wallMetalness: 0.16,
    accentColor: 0x2e3237, accentRoughness: 0.55,
    // Dark honed stone instead of the pale wood plank floor, which read as
    // domestic against a steel vault shell. Same stone-joint technique as
    // White's floor, tinted charcoal with a subdued (not bright) joint line.
    floorColor: 0x2c2e30, floorRoughness: 0.48, floorTreatment: "stone", jointColor: "#4a4e52",
    // Muted aged bronze — lower metalness/higher roughness than before so
    // it reads as brushed hardware catching light locally, not a glowing
    // chrome band running the length of the wall.
    trimColor: 0x9c7a44, trimMetalness: 0.55, trimRoughness: 0.48,
    darkColor: 0x1e2124, darkMetalness: 0.3,
    ceilingColor: 0x35393d,
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
  } else {
    const stoneCanvas = document.createElement("canvas");
    stoneCanvas.width = stoneCanvas.height = 512;
    const stoneCtx = stoneCanvas.getContext("2d")!;
    // Reuse the grain texture's own source canvas as the stone floor's base
    // grain, same as before this was extracted into a shared generator.
    stoneCtx.drawImage(grain.image as CanvasImageSource, 0, 0);
    // A visible-but-subdued cross join splits each repeat unit into 4 square
    // slabs (world-scale tile pitch/repeat() below unchanged) plus a faint
    // per-slab tone shift so slabs read as individual stone/tile pieces
    // without a bold checkerboard.
    let stoneSeed = 811;
    const stoneRandom = () => ((stoneSeed = (Math.imul(stoneSeed, 1664525) + 1013904223) >>> 0) / 4294967296);
    for (const qx of [0, 256]) {
      for (const qy of [0, 256]) {
        const shift = (stoneRandom() - 0.5) * 10;
        stoneCtx.fillStyle = shift >= 0 ? `rgba(255,255,255,${shift / 255})` : `rgba(50,46,38,${-shift / 255})`;
        stoneCtx.fillRect(qx, qy, 256, 256);
      }
    }
    stoneCtx.strokeStyle = palette.jointColor;
    stoneCtx.lineWidth = 3;
    stoneCtx.strokeRect(1.5, 1.5, 509, 509);
    stoneCtx.beginPath();
    stoneCtx.moveTo(256, 0);
    stoneCtx.lineTo(256, 512);
    stoneCtx.moveTo(0, 256);
    stoneCtx.lineTo(512, 256);
    stoneCtx.stroke();
    const stone = new THREE.CanvasTexture(stoneCanvas);
    stone.colorSpace = THREE.SRGBColorSpace;
    stone.wrapS = stone.wrapT = THREE.RepeatWrapping;
    stone.repeat.set(10.5, 13);
    stone.anisotropy = 8;
    floorTexture = stone;
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
    bumpMap: palette.floorTreatment === "stone" ? floorTexture : undefined,
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
  if (style === "vault") {
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
      else if (name.includes("case_base")) object.material = style === "vault" ? dark : wall;
      else if (name.includes("shelf") || name.includes("corner_post") || name.includes("door")) object.material = dark;
      else if (name.includes("wall")) object.material = name === "back_wall" ? charcoal : wall;
      // Design-chat brief (2026-09-06, guarded THIRD pass, reference-image
      // hierarchy): "Remove the continuous gold horizontal accent lines and
      // gold baseboard treatment from Vault... Shelf supports should
      // primarily read as dark steel... brass should catch light locally,
      // not glow across the whole room." Vault-only — White/Arcade keep
      // their existing brass rail/baseboard, unchanged.
      else if (name.includes("rail") || name.includes("baseboard")) object.material = style === "vault" ? dark : brass;
      else if (name.includes("stile")) object.material = dark;
      object.receiveShadow = true;
    });
  }

  function addLighting(room: THREE.Group) {
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
    const targets: Array<[number, number, number, number, number, number]> = [
      [-6, 8.4, -8.9, -6, 3.7, -12], [0, 8.4, -8.9, 0, 3.7, -12], [6, 8.4, -8.9, 6, 3.7, -12],
      [-7.4, 8.4, -6.5, -10.5, 3.7, -6.5], [-7.4, 8.4, 1.5, -10.5, 3.7, 1.5],
      [7.4, 8.4, -6.5, 10.5, 3.7, -6.5], [7.4, 8.4, 1.5, 10.5, 3.7, 1.5],
    ];
    targets.forEach(([x, y, z, tx, ty, tz], index) => {
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
      const light = new THREE.SpotLight(0xffe6bd, 55, 16, Math.PI / 4.6, 0.88, 1.25);
      light.position.set(x, y - 0.2, z);
      light.target.position.set(tx, ty, tz);
      // Only the central beam needs a shadow map: keep mobile fill cost bounded.
      light.castShadow = index === 1;
      if (light.castShadow) {
        light.shadow.mapSize.set(1024, 1024);
        light.shadow.bias = -0.0002;
        light.shadow.normalBias = 0.035;
      }
      room.add(light, light.target);
    });

    // Vault only: a dedicated angled side light on the door/arch assembly
    // (the real GLB geometry sits roughly x=0, z≈5.2-5.7 — see
    // "vault_plate_top"/"vault_left_post"/"vault_right_post" positions,
    // confirmed live via __vltdDebug). EK's ask: "the door...needs
    // form-defining side light and contact shadow" — raking light from one
    // side reveals the recess/rings/bolts/thickness that flat overhead
    // wash was flattening out. One modest, non-shadow-casting spot, not a
    // second full fixture rig.
    if (style === "vault") {
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
  return { wall, floor, brass, apply, addLighting, addCaseDetails, dispose() {
    textures.forEach((texture) => texture.dispose());
    materials.forEach((material) => material.dispose());
  } };
}
