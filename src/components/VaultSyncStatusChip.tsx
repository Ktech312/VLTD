"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { hasSupabaseEnv } from "@/lib/vaultCloud";
import { getAllLocalItems } from "@/lib/vaultModel";
import { getPendingVaultSyncCount, processVaultSyncQueue } from "@/lib/vaultSyncQueue";

type SyncSnapshot = {
  online: boolean;
  pendingCount: number;
  pendingImageCount: number;
};

function readSnapshot(): SyncSnapshot {
  if (typeof window === "undefined") {
    return { online: true, pendingCount: 0, pendingImageCount: 0 };
  }

  const items = getAllLocalItems();
  return {
    online: navigator.onLine,
    pendingCount: getPendingVaultSyncCount(),
    pendingImageCount: items.reduce(
      (count, item) => count + (item.images ?? []).filter((image) => image?.localOnly).length,
      0
    ),
  };
}

export default function VaultSyncStatusChip() {
  const [snapshot, setSnapshot] = useState<SyncSnapshot>(() => ({
    online: true,
    pendingCount: 0,
    pendingImageCount: 0,
  }));
  const [message, setMessage] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);

  const refresh = useCallback(() => {
    setSnapshot(readSnapshot());
  }, []);

  const handleRetrySync = useCallback(async () => {
    if (isSyncing || !hasSupabaseEnv() || (typeof navigator !== "undefined" && !navigator.onLine)) {
      refresh();
      return;
    }

    setIsSyncing(true);
    setMessage("Syncing...");

    try {
      const result = await processVaultSyncQueue();
      refresh();
      setMessage(
        result.remaining > 0
          ? `${result.remaining} change${result.remaining === 1 ? "" : "s"} still queued.`
          : "Vault sync is up to date."
      );
      window.setTimeout(() => setMessage(""), 3500);
    } catch (error) {
      refresh();
      setMessage(error instanceof Error ? error.message : "Sync retry failed.");
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, refresh]);

  useEffect(() => {
    refresh();

    const onOnline = () => {
      refresh();
      void handleRetrySync();
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", refresh);
    window.addEventListener("vltd:vault-updated", refresh);
    window.addEventListener("storage", refresh);

    const timer = window.setInterval(refresh, 15000);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", refresh);
      window.removeEventListener("vltd:vault-updated", refresh);
      window.removeEventListener("storage", refresh);
      window.clearInterval(timer);
    };
  }, [handleRetrySync, refresh]);

  const tone = useMemo(() => {
    if (!snapshot.online) return "offline";
    if (snapshot.pendingCount > 0 || snapshot.pendingImageCount > 0) return "pending";
    return "ready";
  }, [snapshot.online, snapshot.pendingCount, snapshot.pendingImageCount]);

  if (
    tone === "ready" &&
    !message
  ) {
    return null;
  }

  const label = !snapshot.online
    ? "Offline capture mode"
    : snapshot.pendingCount > 0 || snapshot.pendingImageCount > 0
      ? "Sync queued"
      : message || "Synced";

  const detail = !snapshot.online
    ? `${snapshot.pendingCount} change${snapshot.pendingCount === 1 ? "" : "s"} and ${snapshot.pendingImageCount} image${snapshot.pendingImageCount === 1 ? "" : "s"} saved locally.`
    : message ||
      `${snapshot.pendingCount} change${snapshot.pendingCount === 1 ? "" : "s"} pending` +
        (snapshot.pendingImageCount > 0
          ? `, ${snapshot.pendingImageCount} image${snapshot.pendingImageCount === 1 ? "" : "s"} waiting`
          : "");

  return (
    <div className="pointer-events-none fixed bottom-[calc(var(--bottomnav-h,64px)+0.75rem)] left-3 right-3 z-[70] flex justify-center sm:bottom-4">
      <div
        className={[
          "pointer-events-auto flex max-w-[min(92vw,680px)] flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm shadow-[0_18px_60px_rgba(0,0,0,0.28)] ring-1 backdrop-blur",
          tone === "offline"
            ? "bg-amber-950/85 text-amber-50 ring-amber-400/25"
            : tone === "pending"
              ? "bg-[color:var(--surface)] text-[color:var(--fg)] ring-[color:var(--theme-gold-border)]"
              : "bg-emerald-950/85 text-emerald-50 ring-emerald-400/25",
        ].join(" ")}
      >
        <div className="min-w-0">
          <div className="font-semibold">{label}</div>
          <div className="mt-0.5 text-xs opacity-75">{detail}</div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/vault/sync"
            className="rounded-[8px] bg-[color:var(--pill)] px-3 py-1.5 text-xs font-semibold ring-1 ring-[color:var(--border)]"
          >
            Details
          </Link>
          {snapshot.online && (snapshot.pendingCount > 0 || snapshot.pendingImageCount > 0 || message) ? (
            <button
              type="button"
              onClick={() => void handleRetrySync()}
              disabled={isSyncing}
              className="rounded-[8px] bg-[color:var(--pill)] px-3 py-1.5 text-xs font-semibold ring-1 ring-[color:var(--border)] disabled:opacity-50"
            >
              {isSyncing ? "Syncing" : "Retry sync"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
