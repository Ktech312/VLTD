// One answer to "is what I just saved in my account yet?", shared by every save that goes device-first, cloud-second
// (vault items through the sync queue, exhibitions through their cloud upsert).
//
// Found by testing (2026-10-13): when the cloud refused a save, the item stayed on the device and was retried quietly, but the
// person was told nothing, so "saved" and "saved on this device only" looked the same.
//
// States, per source:
//   saving   a cloud save is in flight
//   pending  saved on this device, the cloud has not accepted it yet (offline, error, refused); it is retried automatically
//   saved    the cloud accepted it (shown briefly)
//   idle     nothing to say
// The one shown to the person is the most worrying: pending > saving > saved > idle.

export type CloudSavePhase = "idle" | "saving" | "pending" | "saved";
export type CloudSaveSource = "items" | "exhibitions" | "goals";

const SAVED_SHOWN_MS = 4000;
const RETRY_DELAYS_MS = [15_000, 30_000, 60_000, 120_000, 300_000];

const phases: Record<CloudSaveSource, CloudSavePhase> = { items: "idle", exhibitions: "idle", goals: "idle" };
const retries = new Set<() => Promise<unknown> | unknown>();
const listeners = new Set<() => void>();
let savedTimer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let attempt = 0;
let onlineHooked = false;

function notify() {
  for (const listener of Array.from(listeners)) listener();
}

export function getCloudSavePhase(): CloudSavePhase {
  const all = Object.values(phases);
  if (all.includes("pending")) return "pending";
  if (all.includes("saving")) return "saving";
  if (all.includes("saved")) return "saved";
  return "idle";
}

export function subscribeCloudSave(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function clearRetryTimer() {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
}

function scheduleRetry() {
  if (typeof window === "undefined" || retryTimer) return;
  if (!onlineHooked) {
    onlineHooked = true;
    // Coming back online is the best moment to try again.
    window.addEventListener("online", () => void retryCloudSavesNow());
  }
  const delay = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
  attempt += 1;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void retryCloudSavesNow();
  }, delay);
}

/** Each kind of save registers how to try again; the retry button and the automatic retries call them all. */
export function registerCloudSaveRetry(fn: () => Promise<unknown> | unknown) {
  retries.add(fn);
  return () => {
    retries.delete(fn);
  };
}

export async function retryCloudSavesNow() {
  clearRetryTimer();
  for (const fn of Array.from(retries)) {
    try {
      await fn();
    } catch {
      /* the retry itself reports its outcome through the report* calls */
    }
  }
}

function set(source: CloudSaveSource, next: CloudSavePhase) {
  if (phases[source] === next) return;
  phases[source] = next;
  if (next === "pending") scheduleRetry();
  if (getCloudSavePhase() !== "pending") {
    clearRetryTimer();
    attempt = 0;
  }
  notify();
}

export function reportSaving(source: CloudSaveSource) {
  // A source that is already waiting stays "pending" until the cloud actually accepts something.
  if (phases[source] === "pending") return;
  set(source, "saving");
}

export function reportPending(source: CloudSaveSource) {
  set(source, "pending");
  // Still pending after a failed retry: keep trying, a little less often each time.
  scheduleRetry();
}

export function reportSaved(source: CloudSaveSource) {
  set(source, "saved");
  if (savedTimer) clearTimeout(savedTimer);
  savedTimer = setTimeout(() => {
    savedTimer = null;
    for (const key of Object.keys(phases) as CloudSaveSource[]) {
      if (phases[key] === "saved") phases[key] = "idle";
    }
    notify();
  }, SAVED_SHOWN_MS);
}

export function reportIdle(source: CloudSaveSource) {
  set(source, "idle");
}

/** Sign-out or a different person: whatever was being said belonged to the previous person. */
export function resetCloudSaveStatus() {
  for (const key of Object.keys(phases) as CloudSaveSource[]) phases[key] = "idle";
  clearRetryTimer();
  attempt = 0;
  notify();
}
