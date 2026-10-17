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
let failedAt = 0; // when the last storage write failed (a full browser store is retried at most every 30 s, not on every read)
const RETRY_AFTER_FAILURE_MS = 30_000;

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

// A fingerprint of the exact stored text. It is kept in its own small key to say "this exact text has already been through the
// repair step and comes out of it unchanged", so the next page load can read it without repairing every item again. It describes
// text, not a person: if the stored text is different in any way (another tab, a restore, another account's copy, an interrupted
// save) the fingerprint does not match and the full repair runs, exactly as it always did.
const REPAIRED_KEY = "vltd_vault_items_repaired_v1";

function fingerprint(text: string): string {
  let h = 0x811c9dc5;
  let g = 5381;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h ^= c;
    h = Math.imul(h, 0x01000193) >>> 0;
    g = (Math.imul(g, 33) + c) >>> 0;
  }
  return text.length + ":" + h.toString(16) + ":" + g.toString(16);
}

/** Says the stored text, exactly as it is right now, is already in its repaired form. Not possible while the copy only lives in memory. */
export function markVaultLocalRepaired(): boolean {
  if (typeof window === "undefined" || memoryJson !== null) return false;
  const stored = readStored();
  if (stored === null) return false;
  try {
    window.localStorage.setItem(REPAIRED_KEY, fingerprint(stored));
    return true;
  } catch {
    return false;
  }
}

/** True only when the stored text is byte-for-byte the text that was marked as already repaired. */
export function isVaultLocalRepaired(): boolean {
  if (typeof window === "undefined" || memoryJson !== null) return false;
  try {
    const mark = window.localStorage.getItem(REPAIRED_KEY);
    if (!mark) return false;
    const stored = readStored();
    return stored !== null && mark === fingerprint(stored);
  } catch {
    return false;
  }
}

/** Reads a stored copy of the local vault (compressed or plain) without touching the live one, e.g. a parked copy. */
export function decodeVaultLocalCopy(stored: string): string | null {
  return decode(stored);
}

/**
 * Forgets the copies held in memory. They belong to whoever was signed in before: after the device's data moves to another
 * person (or is parked on sign-out) the next read must come from storage.
 */
export function resetVaultLocalMemory() {
  memoryJson = null;
  lastStored = null;
  lastJson = null;
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

  // The browser refused the last write and this is the very same text: compressing multi megabytes again on every read
  // just to be refused again froze the page. The in-memory copy is already current.
  if (memoryJson !== null && json === memoryJson && Date.now() - failedAt < RETRY_AFTER_FAILURE_MS) return false;

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
    failedAt = 0;
    return true;
  } catch {
    memoryJson = json;
    failedAt = Date.now();
    if (!warned) {
      warned = true;
      console.warn("VLTD: could not save the local vault copy; keeping it in memory for this session.");
    }
    return false;
  }
}
