"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { PillButton } from "@/components/ui/PillButton";
import {
  getVaultSyncQueueSnapshot,
  processVaultSyncQueue,
  type VaultSyncQueueSnapshot,
} from "@/lib/vaultSyncQueue";

function readSnapshot(): VaultSyncQueueSnapshot {
  return getVaultSyncQueueSnapshot();
}

function formatDateTime(value: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function SurfaceCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "rounded-[28px] bg-[color:var(--surface)] ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

function RowCard({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl bg-[color:var(--pill)] p-3 ring-1 ring-[color:var(--border)]">{children}</div>;
}

export default function VaultSyncPage() {
  const [snapshot, setSnapshot] = useState<VaultSyncQueueSnapshot>(() => ({
    online: true,
    hasCloudSync: false,
    pendingCount: 0,
    pendingImageCount: 0,
    items: [],
  }));
  const [status, setStatus] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);

  const refresh = useCallback(() => {
    setSnapshot(readSnapshot());
  }, []);

  useEffect(() => {
    refresh();

    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    window.addEventListener("vltd:vault-updated", refresh);
    window.addEventListener("storage", refresh);

    const timer = window.setInterval(refresh, 15000);

    return () => {
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
      window.removeEventListener("vltd:vault-updated", refresh);
      window.removeEventListener("storage", refresh);
      window.clearInterval(timer);
    };
  }, [refresh]);

  const readiness = useMemo(() => {
    if (!snapshot.online) return { label: "Offline", detail: "New captures and edits are saved locally until this device is online." };
    if (!snapshot.hasCloudSync) return { label: "Local only", detail: "Supabase is not configured in this environment, so queued work stays local." };
    if (snapshot.pendingCount > 0 || snapshot.pendingImageCount > 0) return { label: "Ready to sync", detail: "Queued records and local-only images can be retried now." };
    return { label: "Up to date", detail: "There are no queued vault changes on this device." };
  }, [snapshot.hasCloudSync, snapshot.online, snapshot.pendingCount, snapshot.pendingImageCount]);

  async function handleRetry() {
    if (isSyncing) return;
    setIsSyncing(true);
    setStatus("Syncing queued vault changes...");

    try {
      const result = await processVaultSyncQueue();
      refresh();
      setStatus(
        result.remaining > 0
          ? `${result.processed} processed, ${result.remaining} still queued.`
          : `${result.processed} processed. Queue is clear.`
      );
    } catch (error) {
      refresh();
      setStatus(error instanceof Error ? error.message : "Sync retry failed.");
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <main className="bg-[color:var(--bg)] text-[color:var(--fg)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col px-4 py-5 sm:px-6 sm:py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--muted2)]">VLTD Sync</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Offline capture queue</h1>
            <p className="mt-2 max-w-3xl text-sm text-[color:var(--muted)]">
              Review the item records and local images waiting to sync from this device.
            </p>
          </div>

          <Link
            href="/vault"
            className="inline-flex h-11 items-center rounded-full px-4 text-sm font-medium ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill)]"
          >
            Back to Vault
          </Link>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="space-y-4">
            <SurfaceCard className="p-4 sm:p-5">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">Status</div>
              <div className="mt-3 text-2xl font-semibold">{readiness.label}</div>
              <div className="mt-2 text-sm text-[color:var(--muted)]">{readiness.detail}</div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <RowCard>
                  <div className="text-xs text-[color:var(--muted)]">Queued Changes</div>
                  <div className="mt-1 text-xl font-semibold">{snapshot.pendingCount}</div>
                </RowCard>
                <RowCard>
                  <div className="text-xs text-[color:var(--muted)]">Local Images</div>
                  <div className="mt-1 text-xl font-semibold">{snapshot.pendingImageCount}</div>
                </RowCard>
                <RowCard>
                  <div className="text-xs text-[color:var(--muted)]">Network</div>
                  <div className="mt-1 text-xl font-semibold">{snapshot.online ? "Online" : "Offline"}</div>
                </RowCard>
                <RowCard>
                  <div className="text-xs text-[color:var(--muted)]">Cloud Sync</div>
                  <div className="mt-1 text-xl font-semibold">{snapshot.hasCloudSync ? "Configured" : "Local"}</div>
                </RowCard>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <PillButton
                  variant="primary"
                  onClick={() => void handleRetry()}
                  disabled={isSyncing || !snapshot.online || !snapshot.hasCloudSync}
                >
                  {isSyncing ? "Syncing..." : "Retry Sync"}
                </PillButton>
                <PillButton onClick={refresh}>Refresh</PillButton>
              </div>

              {status ? (
                <div className="mt-3 rounded-[20px] bg-[color:var(--pill)] px-4 py-3 text-sm ring-1 ring-[color:var(--border)]">
                  {status}
                </div>
              ) : null}
            </SurfaceCard>

            <SurfaceCard className="p-4 sm:p-5">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">Add More</div>
              <div className="mt-4 grid gap-2">
                <Link className="rounded-2xl bg-[color:var(--pill)] px-4 py-3 text-sm ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill-hover)]" href="/capture">
                  Smart Scan camera
                </Link>
                <Link className="rounded-2xl bg-[color:var(--pill)] px-4 py-3 text-sm ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill-hover)]" href="/vault/quick">
                  Quick add
                </Link>
                <Link className="rounded-2xl bg-[color:var(--pill)] px-4 py-3 text-sm ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill-hover)]" href="/vault/import">
                  Spreadsheet import
                </Link>
              </div>
            </SurfaceCard>
          </div>

          <SurfaceCard className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">Pending Items</div>
                <div className="mt-1 text-sm text-[color:var(--muted)]">Records sync first, then any local-only images upload and update the saved item.</div>
              </div>
              <div className="text-sm text-[color:var(--muted)]">{snapshot.items.length} queued</div>
            </div>

            <div className="mt-4 space-y-3">
              {snapshot.items.length === 0 ? (
                <RowCard><div className="text-sm text-[color:var(--muted)]">No pending queue entries.</div></RowCard>
              ) : (
                snapshot.items.map((entry) => (
                  <RowCard key={entry.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-[color:var(--fg)]">
                          {entry.item?.title || "Missing local item"}
                        </div>
                        <div className="mt-1 text-xs text-[color:var(--muted)]">
                          Queued {formatDateTime(entry.createdAt)}
                          {entry.item?.categoryLabel ? ` - ${entry.item.categoryLabel}` : ""}
                        </div>
                        {entry.missingLocalItem ? (
                          <div className="mt-2 text-xs text-amber-300">This queue entry points to an item that no longer exists locally.</div>
                        ) : null}
                      </div>
                      <div className="shrink-0 text-right text-xs text-[color:var(--muted)]">
                        <div>{entry.pendingImageCount} image{entry.pendingImageCount === 1 ? "" : "s"}</div>
                        <div className="mt-1">{entry.missingLocalItem ? "Skipped on retry" : "Ready"}</div>
                      </div>
                    </div>
                  </RowCard>
                ))
              )}
            </div>
          </SurfaceCard>
        </div>
      </div>
    </main>
  );
}
