import { strFromU8, strToU8, unzlibSync, zlibSync } from "fflate";

// The browser gives each site only ~5 MB of localStorage. The local copy of
// the vault repeats every photo link several times per item, so a few thousand
// items overflowed it -- and because the write error was swallowed, newly
// pulled items silently never appeared. The local copy is now stored
// compressed (roughly 8x smaller). Plain JSON written by older versions is
// still read as-is and converted on the next save. If the write still fails,
// the copy is kept in memory for the session so the Vault keeps working.
export const VAULT_ITEMS_LS_KEY = "vltd_vault_items_v1";
const PACKED_PREFIX = "z64:";

let memoryJson: string | null = null; // only set while a storage write is failing
let lastStored: string | null = null; // last raw value read from / written to storage
let lastJson: string | null = null; // its decoded JSON text
let warned = false;

function pack(json: string): string {
  const bytes = zlibSync(strToU8(json), { level: 6 });
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return PACKED_PREFIX + window.btoa(binary);
}

function decode(stored: string): string | null {
  if (!stored.startsWith(PACKED_PREFIX)) return stored; // older plain-JSON copy
  try {
    const binary = window.atob(stored.slice(PACKED_PREFIX.length));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return strFromU8(unzlibSync(bytes));
  } catch {
    return null;
  }
}

function readStored(): string | null {
  try {
    return window.localStorage.getItem(VAULT_ITEMS_LS_KEY);
  } catch {
    return null;
  }
}

/** The local vault as JSON text, or null if there is none. */
export function readVaultLocalJson(): string | null {
  if (typeof window === "undefined") return null;
  if (memoryJson !== null) return memoryJson;
  const stored = readStored();
  if (stored === null) return null;
  if (stored === lastStored) return lastJson;
  const json = decode(stored);
  lastStored = stored;
  lastJson = json;
  return json;
}

/** Cheap "has anything changed" token: the stored text itself (or the in-memory copy). */
export function getVaultLocalSignature(): string | null {
  if (typeof window === "undefined") return null;
  if (memoryJson !== null) return memoryJson;
  return readStored();
}

/** Save the local vault. Returns false if it could only be kept in memory. */
export function writeVaultLocalJson(json: string): boolean {
  if (typeof window === "undefined") return false;

  // Nothing changed and it is already stored compressed: skip the work.
  if (memoryJson === null && json === lastJson && lastStored?.startsWith(PACKED_PREFIX)) {
    return true;
  }

  const previous = readStored();
  try {
    const packed = pack(json);
    window.localStorage.setItem(VAULT_ITEMS_LS_KEY, packed);
    // First conversion of an older plain copy: confirm it reads back before
    // trusting it, otherwise put the old copy back.
    if (previous !== null && !previous.startsWith(PACKED_PREFIX)) {
      if (decode(window.localStorage.getItem(VAULT_ITEMS_LS_KEY) ?? "") !== json) {
        window.localStorage.setItem(VAULT_ITEMS_LS_KEY, previous);
        throw new Error("compressed copy did not read back");
      }
    }
    lastStored = packed;
    lastJson = json;
    memoryJson = null;
    return true;
  } catch {
    memoryJson = json;
    if (!warned) {
      warned = true;
      console.warn("VLTD: could not save the local vault copy; keeping it in memory for this session.");
    }
    return false;
  }
}
