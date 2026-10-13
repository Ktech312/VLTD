// Who is signed in on this device RIGHT NOW, read from the stored session (shared by every tab), not from a page's memory.
//
// A request started for one person can finish after another person has signed in (or after sign-out), in this tab or in a
// different one. Code that writes the cloud's answer into the device's personal data, or sends the device's queue to the cloud,
// takes the user id before it starts and checks it again before it writes: if the person changed, the result is dropped.

const AUTH_STORAGE_KEY = "vltd-auth";

/** The signed-in user's id according to the stored session, or null when nobody is signed in. */
export function storedSessionUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown> | null;
    if (!parsed || typeof parsed !== "object") return null;
    const session = (parsed.currentSession ?? parsed.session ?? parsed) as { user?: { id?: unknown } } | null;
    const id = session?.user?.id;
    return typeof id === "string" && id ? id : null;
  } catch {
    return null;
  }
}

/** True while `startedAs` is still the person signed in (null = nobody was). */
export function stillSignedInAs(startedAs: string | null): boolean {
  return storedSessionUserId() === startedAs;
}

const ACTIVE_PROFILE_STORAGE_KEY = "vltd_active_profile_id_v1";

function storedActiveProfileId(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

/**
 * Call before a cloud request; call the function it returns when the answer arrives. It says whether the signed-in person AND
 * the active profile are still the ones the request was made for. When it says no, drop the answer: saving it would file one
 * profile's (or person's) data under another's, and pushing the device's copy would upload it to the wrong profile.
 */
export function captureIdentity(): () => boolean {
  const user = storedSessionUserId();
  const profile = storedActiveProfileId();
  return () => storedSessionUserId() === user && storedActiveProfileId() === profile;
}
