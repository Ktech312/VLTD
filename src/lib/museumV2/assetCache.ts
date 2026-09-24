// Museum Runtime V2 (2026-09-23) — asset loading and caching.
// Loads a published room bake (museumRoomBake.ts's publishRoomBake() output,
// museum_room_meta.baked_asset_url) via GLTFLoader and caches the parsed
// result per URL, so re-entering a room that's already been streamed once
// this session doesn't re-download/re-parse its .glb.

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { disposeObject3D } from "./disposal";

type CacheEntry = { promise: Promise<THREE.Group>; refCount: number };

const gltfLoader = new GLTFLoader();

// Keyed by URL (which already carries Museum Builder's own `?v=timestamp`
// cache-bust query param — see museumRoomBake.ts — so a republish gets a new
// key here automatically instead of serving a stale cached parse).
const cache = new Map<string, CacheEntry>();

/** Loads (or returns the cached parse of) a baked room .glb. The returned
 * group is a fresh clone every call — callers own their own clone's
 * lifetime and can safely mutate/dispose it without affecting other rooms
 * sharing the same source URL (relevant if a visitor leaves and re-enters
 * the same room: each entry gets its own clone, geometry/material buffers
 * are shared under the hood by THREE's own clone()). */
export async function loadBakedRoom(url: string): Promise<THREE.Group> {
  let entry = cache.get(url);
  if (!entry) {
    entry = {
      promise: new Promise<THREE.Group>((resolve, reject) => {
        gltfLoader.load(
          url,
          (gltf) => resolve(gltf.scene),
          undefined,
          (error) => reject(error instanceof Error ? error : new Error(String(error)))
        );
      }),
      refCount: 0,
    };
    cache.set(url, entry);
  }
  entry.refCount += 1;
  const source = await entry.promise;
  return source.clone(true);
}

/** Releases this session's hold on a cached parse — call once per matching
 * loadBakedRoom() when the room instance built from it is disposed. Once no
 * live instance references a URL, its cached parse is dropped too, so a
 * room that's genuinely been abandoned (not just its current on-screen
 * clone) doesn't hold GPU-uploaded geometry/textures forever. */
export function releaseBakedRoom(url: string): void {
  const entry = cache.get(url);
  if (!entry) return;
  entry.refCount -= 1;
  if (entry.refCount <= 0) {
    cache.delete(url);
    void entry.promise.then((source) => disposeObject3D(source)).catch(() => {});
  }
}
