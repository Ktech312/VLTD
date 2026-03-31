// Path: src/lib/clientVaultId.ts

/**
 * Collision-resistant client-side IDs.
 * - Prefer crypto.randomUUID()
 * - Fallback: time + per-ms counter + random
 *
 * Optional prefix (default "v") so you can distinguish sources if you want:
 *   createClientVaultId("v")   -> v_<uuid>
 *   createClientVaultId("vq")  -> vq_<uuid>
 *   createClientVaultId("x")   -> x_<time>_<ctr>_<rand>
 */
let __vltd_id_counter = 0;
let __vltd_id_last_ms = 0;

export function createClientVaultId(prefix: string = "v") {
  // keep prefix safe-ish
  const p = String(prefix || "v").replace(/[^a-z0-9_]/gi, "").slice(0, 12) || "v";

  if (typeof crypto !== "undefined" && typeof (crypto as any).randomUUID === "function") {
    // include prefix so IDs are recognizable & consistent across paths
    return `${p}_${(crypto as any).randomUUID() as string}`;
  }

  const ms = Date.now();
  if (ms === __vltd_id_last_ms) __vltd_id_counter += 1;
  else {
    __vltd_id_last_ms = ms;
    __vltd_id_counter = 0;
  }

  const rand = Math.floor(Math.random() * 1e9)
    .toString(36)
    .padStart(6, "0");
  const ctr = __vltd_id_counter.toString(36).padStart(2, "0");

  return `${p}_${ms.toString(36)}_${ctr}_${rand}`;
}