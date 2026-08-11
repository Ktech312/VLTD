import { prepareZXingModule } from "zxing-wasm/reader";

/** One-time zxing-wasm setup: points the module at the self-hosted .wasm
 *  binary (public/zxing_reader.wasm, copied from node_modules by
 *  scripts/copy-zxing-wasm.js on install) instead of the library's default
 *  jsDelivr CDN fetch. Self-hosting means one fewer third-party dependency
 *  for a feature EK's collectors actually rely on, and one fewer thing that
 *  can break from a CDN hiccup or a strict CSP later. Safe to call more than
 *  once -- `prepareZXingModule` de-dupes identical overrides internally. */
let warmed = false;

export function warmupZXingWasm(): void {
  if (warmed || typeof window === "undefined") return;
  warmed = true;
  prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? "/zxing_reader.wasm" : prefix + path),
    },
    // Start fetching/compiling the ~1MB wasm binary as soon as the camera
    // opens, not on the first Scan tap -- so the first burst isn't spent
    // waiting on a cold module load.
    fireImmediately: true,
  });
}
