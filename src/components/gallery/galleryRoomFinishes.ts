import * as THREE from "three";

/** Finishes for the existing White room. No changes to its shell or slot geometry. */
export function createGalleryFinishes() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  let seed = 47;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const pixels = ctx.createImageData(512, 512);
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const i = (y * 512 + x) * 4;
      const cloud = Math.sin(x / 38 + Math.sin(y / 47)) * 3 + Math.cos(y / 61) * 2;
      const tone = 216 + cloud + (random() - 0.5) * 13;
      pixels.data.set([tone, tone - 3, tone - 8, 255], i);
    }
  }
  ctx.putImageData(pixels, 0, 0);
  const plaster = new THREE.CanvasTexture(canvas);
  plaster.colorSpace = THREE.SRGBColorSpace;
  plaster.wrapS = plaster.wrapT = THREE.RepeatWrapping;
  plaster.repeat.set(5, 3);
  plaster.anisotropy = 4;

  const stoneCanvas = document.createElement("canvas");
  stoneCanvas.width = stoneCanvas.height = 512;
  const stoneCtx = stoneCanvas.getContext("2d")!;
  stoneCtx.drawImage(canvas, 0, 0);
  // Fine joints, with mineral grain rather than a high-contrast checkerboard.
  stoneCtx.strokeStyle = "#aaa59b";
  stoneCtx.lineWidth = 2;
  stoneCtx.strokeRect(0, 0, 512, 512);
  const stone = new THREE.CanvasTexture(stoneCanvas);
  stone.colorSpace = THREE.SRGBColorSpace;
  stone.wrapS = stone.wrapT = THREE.RepeatWrapping;
  stone.repeat.set(10.5, 13);
  stone.anisotropy = 8;
  const wall = new THREE.MeshStandardMaterial({ map: plaster, bumpMap: plaster, bumpScale: 0.025, color: 0xe3ddd0, roughness: 0.94 });
  const charcoal = new THREE.MeshStandardMaterial({ map: plaster, bumpMap: plaster, bumpScale: 0.025, color: 0x454846, roughness: 0.9 });
  const floor = new THREE.MeshStandardMaterial({ map: stone, bumpMap: stone, bumpScale: 0.025, color: 0xaaa79e, roughness: 0.82 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xa68b53, metalness: 0.72, roughness: 0.43 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x303330, metalness: 0.18, roughness: 0.65 });
  const ceiling = new THREE.MeshStandardMaterial({ color: 0xbeb9af, roughness: 0.98 });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xe6f0ee, transparent: true, opacity: 0.12, roughness: 0.12,
    metalness: 0, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide,
  });
  const finishes = [wall, charcoal, floor, brass, dark, ceiling, glass];
  finishes.forEach((material) => { material.envMapIntensity = 0.35; });
  const materials: THREE.Material[] = [...finishes];

  function apply(model: THREE.Group) {
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const name = object.name.toLowerCase();
      if (name.includes("floor")) {
        // Replace the baked parquet overlay with one continuous stone surface.
        object.visible = name === "floor_slab";
        object.material = floor;
        if (name === "floor_slab") {
          // World-size UVs keep tiles square on the original 21 x 26 slab.
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
        // The old solid lid hid objects viewed from above. The four-sided
        // rim below keeps the case's outline while leaving its glass top clear.
        object.visible = false;
      } else if (name.includes("glass")) {
        object.material = glass;
        object.castShadow = false;
      } else if (name.includes("ceiling")) object.material = ceiling;
      else if (name.includes("case_base")) object.material = wall;
      else if (name.includes("shelf") || name.includes("corner_post") || name.includes("door")) object.material = dark;
      else if (name.includes("wall")) object.material = name === "back_wall" ? charcoal : wall;
      else if (name.includes("rail") || name.includes("baseboard")) object.material = brass;
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
      const light = new THREE.SpotLight(0xffe6bd, 55, 16, Math.PI / 5.4, 0.75, 1.25);
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
  }
  function addCaseDetails(room: THREE.Group, spots: Array<[number, number]>) {
    const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xa99570, transparent: true, opacity: 0.6 });
    materials.push(edgeMaterial);
    spots.forEach(([x, z]) => {
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
    plaster.dispose(); stone.dispose(); materials.forEach((material) => material.dispose());
  } };
}
