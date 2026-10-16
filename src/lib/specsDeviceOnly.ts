// Specialist details (item.specs) are saved in the person's account only once the database has the column for them.
// Until it does, a save succeeds for everything else and the specs stay on this device. That must be said plainly, never as
// "Saved to your account", and the items must be sent again automatically once the column exists.
//
// This keeps the list of items whose last cloud save did not carry their specs. It is part of the device's personal data
// (moved aside when someone else signs in, see localDataOwner.ts).

const KEY = "vltd_specs_device_only_v1";
const EVENT = "vltd:specs-device-only";

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function write(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    if (ids.length) window.localStorage.setItem(KEY, JSON.stringify(ids));
    else window.localStorage.removeItem(KEY);
  } catch {
    /* storage full or blocked: the notice is lost, the data is not */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function getSpecsDeviceOnlyIds(): string[] {
  return read();
}

export function isSpecsDeviceOnly(itemId: string): boolean {
  return read().includes(String(itemId));
}

export function hasAnySpecsDeviceOnly(): boolean {
  return read().length > 0;
}

export function markSpecsDeviceOnly(itemId: string) {
  const ids = read();
  if (!ids.includes(String(itemId))) write([...ids, String(itemId)]);
}

export function clearSpecsDeviceOnly(itemId: string) {
  const ids = read();
  if (ids.includes(String(itemId))) write(ids.filter((id) => id !== String(itemId)));
}

export function subscribeSpecsDeviceOnly(listener: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

export const SPECS_DEVICE_ONLY_NOTE = "Specialist details are saved on this device only for now. They are not in your account yet.";
