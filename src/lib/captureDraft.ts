// /capture: an unsaved item is kept as a DRAFT so leaving the page, refreshing or a crash does not lose it (audit ADD-035, ADD-037).
//
//   Where:    text fields in localStorage, photos in IndexedDB. Both under a key made of the signed-in account AND the active profile, so
//             another account (or another profile) on the same browser never sees or inherits it.
//   When:     saved a moment after each change while the form holds something; removed when the form is empty again.
//   Cleared:  only after the item was saved, or when the person presses "Discard draft".
//   Restore:  fills the form and the photos ONLY. It never runs the AI identify or any other request.
//
// Pure rules are separate (captureDraftScope, draftHasContent) so they can be tested without a browser.

export const CAPTURE_DRAFT_KEY = "vltd_capture_draft_v1";
const DB_NAME = "vltd-capture-drafts-v1";
const STORE = "drafts";

/** The scope a draft belongs to. Without a signed-in account there is no safe scope to share, so drafts are per anonymous browser profile. */
export function captureDraftScope(userId: string | null | undefined, profileId: string | null | undefined): string {
  return `${userId || "anon"}:${profileId || "none"}`;
}

/** Does the form hold anything worth keeping? Values that are only the carried-over "locked" fields do not count. */
export function draftHasContent(fields: Record<string, unknown>, baseline: Record<string, unknown>, photoCount: number): boolean {
  if (photoCount > 0) return true;
  return Object.keys(fields).some((key) => {
    if (key === "confidence") return false;
    return String(fields[key] ?? "") !== String(baseline[key] ?? "");
  });
}

export type CaptureDraft<F> = { fields: F; files: File[]; savedAt: number };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("no IndexedDB"));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("open failed"));
  });
}

async function idbPut(scope: string, value: unknown): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, scope);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("write failed"));
  });
  db.close();
}
async function idbGet<T>(scope: string): Promise<T | undefined> {
  const db = await openDb();
  const out = await new Promise<T | undefined>((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).get(scope);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error ?? new Error("read failed"));
  });
  db.close();
  return out;
}
async function idbDelete(scope: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(scope);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("delete failed"));
  });
  db.close();
}

type StoredPhoto = { name: string; type: string; blob: Blob; lastModified: number };

export async function saveCaptureDraft<F>(scope: string, fields: F, files: File[]): Promise<void> {
  if (typeof window === "undefined") return;
  const savedAt = Date.now();
  try {
    window.localStorage.setItem(`${CAPTURE_DRAFT_KEY}:${scope}`, JSON.stringify({ savedAt, fields, photoCount: files.length }));
  } catch {
    /* storage full: the photos below may still be kept */
  }
  try {
    if (files.length > 0) {
      const photos: StoredPhoto[] = files.map((f) => ({ name: f.name, type: f.type, blob: f, lastModified: f.lastModified }));
      await idbPut(scope, photos);
    } else {
      await idbDelete(scope);
    }
  } catch {
    /* no IndexedDB (private window): the text is still kept */
  }
}

export async function loadCaptureDraft<F>(scope: string): Promise<CaptureDraft<F> | null> {
  if (typeof window === "undefined") return null;
  let meta: { savedAt?: number; fields?: F; photoCount?: number } | null = null;
  try {
    const raw = window.localStorage.getItem(`${CAPTURE_DRAFT_KEY}:${scope}`);
    meta = raw ? JSON.parse(raw) : null;
  } catch {
    meta = null;
  }
  let files: File[] = [];
  try {
    const stored = await idbGet<StoredPhoto[]>(scope);
    if (Array.isArray(stored)) files = stored.map((p) => new File([p.blob], p.name, { type: p.type, lastModified: p.lastModified }));
  } catch {
    files = [];
  }
  if (!meta?.fields && files.length === 0) return null;
  return { fields: (meta?.fields ?? ({} as F)) as F, files, savedAt: Number(meta?.savedAt) || Date.now() };
}

export async function clearCaptureDraft(scope: string): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(`${CAPTURE_DRAFT_KEY}:${scope}`);
  } catch {
    /* ignore */
  }
  try {
    await idbDelete(scope);
  } catch {
    /* ignore */
  }
}
