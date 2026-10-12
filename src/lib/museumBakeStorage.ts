import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

/**
 * Baked Museum room files live in a PRIVATE storage bucket (Museum Alpha is owner-only), so a file can only
 * be opened through a short-lived signed link that only the owner's signed-in session can create.
 * museum_room_meta.baked_asset_url holds the file's path plus a cache-busting version ("POP_CULTURE.glb?v=123").
 * Older rows hold the old public URL; both forms are understood here.
 */
export const BAKE_BUCKET = "museum-room-bakes";

const SIGNED_URL_SECONDS = 60 * 60;

/** "POP_CULTURE.glb" from either the stored path form or the old public URL form. */
export function bakeObjectPath(stored: string): string {
  const withoutVersion = String(stored ?? "").split("?")[0];
  const marker = `/${BAKE_BUCKET}/`;
  const at = withoutVersion.indexOf(marker);
  const path = at >= 0 ? withoutVersion.slice(at + marker.length) : withoutVersion;
  return decodeURIComponent(path.replace(/^\/+/, ""));
}

/** A link the GLTF loader can fetch right now. Fails when the signed-in account is not the owner. */
export async function getBakeSignedUrl(stored: string): Promise<string> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Not signed in.");
  const { data, error } = await supabase.storage.from(BAKE_BUCKET).createSignedUrl(bakeObjectPath(stored), SIGNED_URL_SECONDS);
  if (error || !data?.signedUrl) throw new Error(error?.message ?? "Could not open the baked room.");
  return data.signedUrl;
}
