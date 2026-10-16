"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { getCloudSavePhase, reportPending, retryCloudSavesNow, subscribeCloudSave } from "@/lib/cloudSaveStatus";
import { storedSessionUserId } from "@/lib/sessionGuard";
import { hasAnySpecsDeviceOnly, subscribeSpecsDeviceOnly } from "@/lib/specsDeviceOnly";

// Says plainly where a save is: in the person's account, or only on this device so far.
//   "Saved on this device — sync pending"  the cloud has not accepted it yet; it is kept and retried (Retry now tries at once)
//   "Saving to your account…"              on its way
//   "Saved to your account"                the cloud accepted it (shown for a few seconds)
// Nothing is shown when there is nothing to say, or when nobody is signed in. Driven by src/lib/cloudSaveStatus.ts.

const QUEUE_KEY = "vltd_sync_queue_v1";
const PENDING_GALLERIES_KEY = "vltd_gallery_sync_pending_v1";

function hasLeftover(key: string): boolean {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    return false;
  }
}

export default function SyncStatusPill() {
  const phase = useSyncExternalStore(subscribeCloudSave, getCloudSavePhase, () => "idle" as const);
  const [retrying, setRetrying] = useState(false);
  const specsOnDevice = useSyncExternalStore(subscribeSpecsDeviceOnly, hasAnySpecsDeviceOnly, () => false);

  // Changes made on an earlier visit that never reached the account: say so now, and try again.
  useEffect(() => {
    if (!storedSessionUserId()) return;
    let cancelled = false;
    void (async () => {
      if (hasLeftover(QUEUE_KEY)) {
        const queue = await import("@/lib/vaultSyncQueue");
        if (cancelled) return;
        reportPending("items");
        void queue.processVaultSyncQueue();
      }
      if (hasLeftover(PENDING_GALLERIES_KEY)) {
        await import("@/lib/galleryModel"); // starts reporting and retrying on load
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Nothing to say unless someone is signed in (read now, so signing in or out in this or another tab is always honoured).
  if (phase === "idle" || !storedSessionUserId()) return null;

  const pending = phase === "pending";
  // "Saved to your account" is only said when everything that was saved is really there, specialist details included.
  const text = pending
    ? "Saved on this device — sync pending"
    : phase === "saving"
      ? "Saving to your account…"
      : specsOnDevice
        ? "Saved. Specialist details are on this device only for now."
        : "Saved to your account";
  const dot = pending ? "var(--theme-warning, #d99a2b)" : "var(--accent, #C8CDD2)";

  return (
    <div
      role="status"
      aria-live="polite"
      data-cloud-save-status={phase}
      // Placement (checked at phone width, 2026-10-13): above the floating Add Item button, which sits just over the bottom bar, so it never covers
      // either; below every dialog and sheet (they start at z-index 10001), so a dialog's buttons are never hidden behind it.
      className="vltd-keep-color pointer-events-none fixed left-0 right-0 z-[9990] flex justify-center px-4 bottom-[calc(env(safe-area-inset-bottom,0px)+152px)] md:bottom-6"
      // (inline: a site-wide rule on direct children of the page forces z-index 1, which a class cannot override)
      style={{ zIndex: 9990 }}
    >
      <div
        className="pointer-events-auto inline-flex min-h-[36px] max-w-full items-center gap-2 rounded-full px-4 text-xs"
        style={{
          background: "var(--surface-strong, rgba(6,12,20,0.96))",
          border: "1px solid var(--border, rgba(200,205,210,0.3))",
          // a soft shadow keeps the edge visible on light themes, where the pill and the page are both near-white
          boxShadow: "0 2px 10px rgba(0,0,0,0.22)",
          color: "var(--text, #f0f0f0)",
          ["--vltd-keep-color" as string]: "var(--text, #f0f0f0)",
        }}
      >
        <span aria-hidden="true" className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: dot }} />
        <span>{text}</span>
        {pending ? (
          <button
            type="button"
            disabled={retrying}
            onClick={async () => {
              setRetrying(true);
              try {
                await retryCloudSavesNow();
              } finally {
                setRetrying(false);
              }
            }}
            className="-my-1 inline-flex min-h-[44px] items-center px-2 font-semibold underline underline-offset-2 disabled:cursor-wait"
            style={{ color: "inherit" }}
          >
            {retrying ? "Trying…" : "Retry now"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
