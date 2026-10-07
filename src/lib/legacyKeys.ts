/**
 * Older builds kept some lists (sales, wishlist, goals, ...) in one device-wide place. The first profile that
 * reads such a list may adopt it; once any other profile already holds its own copy the old list is not
 * copied again, so a new Business profile never inherits the personal one's data.
 */
export function mayAdoptLegacyKey(legacyKey: string, ownKey: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && key !== ownKey && key.startsWith(`${legacyKey}:`)) return false;
    }
  } catch {
    return false;
  }
  return true;
}
