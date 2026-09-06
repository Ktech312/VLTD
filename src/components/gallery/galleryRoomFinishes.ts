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
    // 2026-09-06, fourth pass: EK's correction — "darken the floor to
    // graphite or nearly black... remove the current pale-gray floor
    // appearance." Cut further than the previous round's charcoal.
    floorColor: 0x17181a, floorRoughness: 0.3, floorTreatment: "stone", jointColor: "#33363a",
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
      // Vault-only cut (2026-09-06, fourth pass): this same rig at White's
      // full 55 was the actual source of EK's "washed-out central artwork"
      // call-out — index 1's target sits exactly on the back-wall center
      // (x=0, z=-12), dead-on and perpendicular to that piece's glass, which
      // reads as a blown-out glare hotspot rather than even illumination.
      // A uniform 30 across all 7 fixtures (first correction attempt) still
      // left that one piece visibly washed out on live re-check — the other
      // 6 pools looked right at 30, only the direct hit needed a further,
      // separate cut. White keeps 55 everywhere (already reviewed/approved).
      const vaultIntensity = index === 1 ? 14 : 30;
      const light = new THREE.SpotLight(0xffe6bd, style === "vault" ? vaultIntensity : 55, 16, Math.PI / 4.6, 0.88, 1.25);
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
    // Fourth pass (2026-09-06), EK's own review of the third pass, point
    // by point: fewer/wider ribs (was too many thin scattered lines),
    // rivets only at real panel junctions (was 2 arbitrary heights per
    // rib — "scattered dots"), the back/side walls split into a few broad
    // bays with real dividers (was one outline spanning the whole wall).
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
    glowSegment(-6, -4, -1, -8);
    glowSegment(-1, -8, 6, -5);
    const glow = new THREE.PointLight(0xcfe1e8, 0.3, 7, 1.4);
    glow.position.set(-1, 8.5, -6);
    room.add(glow);
  }

  return { wall, floor, brass, apply, addLighting, addCaseDetails, addVaultArmor, dispose() {
    textures.forEach((texture) => texture.dispose());
    materials.forEach((material) => material.dispose());
  } };
}
