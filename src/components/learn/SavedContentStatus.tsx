"use client";

import { useSyncExternalStore } from "react";

function subscribe(refresh: () => void) {
  window.addEventListener("vltd-saved-content", refresh);
  window.addEventListener("storage", refresh);
  return () => {
    window.removeEventListener("vltd-saved-content", refresh);
    window.removeEventListener("storage", refresh);
  };
}

export default function SavedContentStatus({ pendingCount }: { pendingCount: () => number }) {
  const pending = useSyncExternalStore(subscribe, pendingCount, () => 0);
  return pending ? <p role="status" className="text-xs text-[color:var(--muted)]">{pending} saved-list {pending === 1 ? "change is" : "changes are"} on this device, waiting to sync to your account.</p> : null;
}
