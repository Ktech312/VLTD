"use client";

// Museum campus perf fix (2026-09-21) — see HANDOFF.md's 2026-09-21 entry
// for the full plan. Museum Builder already runs its own live Three.js
// scene to preview a room while EK edits it; this exports that scene to a
// single .glb file and uploads it, so the live public campus can load a
// static file instead of rebuilding the room from scratch in every
// visitor's browser. No server-side Three.js needed — this all runs in
// Museum Builder's own already-open browser tab, triggered by its
// "Publish" button, not on every autosave.

import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import type { Object3D } from "three";

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { setRoomBakedAsset } from "@/lib/museumCampusConfig";
import { BAKE_BUCKET } from "@/lib/museumBakeStorage";


/** Exports a Three.js object (Museum Builder's own room scene/group) to a
 * binary .glb ArrayBuffer. Wrapped in a Promise since GLTFExporter's
 * `parse()` is callback-based. */
function exportToGlb(object: Object3D): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const exporter = new GLTFExporter();
    exporter.parse(
      object,
      (result) => {
        if (result instanceof ArrayBuffer) {
          resolve(result);
        } else {
          reject(new Error("GLTFExporter did not return binary (.glb) output — check `binary: true` option."));
        }
      },
      (error) => reject(error instanceof Error ? error : new Error(String(error))),
      { binary: true },
    );
  });
}

/** Publishes a room: exports the given Three.js object to .glb, uploads it
 * to the museum-room-bakes bucket, and records the resulting URL on
 * museum_room_meta.baked_asset_url. This is the whole "Publish" action —
 * Museum Builder's "Publish" button calls this directly with its own live
 * scene/room group. Each publish overwrites that room's prior bake at a
 * fixed, predictable path (`${roomId}.glb`) rather than accumulating
 * versions, since the live campus only ever needs the current one. */
export async function publishRoomBake(
  roomId: string,
  object: Object3D,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { ok: false, error: "Not signed in." };

  let glb: ArrayBuffer;
  try {
    glb = await exportToGlb(object);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to export room geometry." };
  }

  const path = `${roomId}.glb`;
  const { error: uploadError } = await supabase.storage
    .from(BAKE_BUCKET)
    .upload(path, glb, { contentType: "model/gltf-binary", upsert: true });
  if (uploadError) return { ok: false, error: uploadError.message };

  // The bucket is private (Museum Alpha is owner-only), so what is stored is the file path plus a version,
  // not a public link. Loading turns it into a short-lived signed link (museumBakeStorage.ts). The version
  // changes on every publish so a stale cached copy is never used.
  const bustedUrl = `${path}?v=${Date.now()}`;

  const saveResult = await setRoomBakedAsset(roomId, bustedUrl);
  if (!saveResult.ok) return { ok: false, error: saveResult.error ?? "Uploaded, but failed to save the link." };

  return { ok: true, url: bustedUrl };
}
