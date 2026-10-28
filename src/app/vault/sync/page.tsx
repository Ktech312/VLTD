"use client";

import { useDialogA11y } from "@/components/ui/useDialogA11y";
import { PageHeader } from "@/components/layout/PageHeader";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { PillButton } from "@/components/ui/PillButton";
import {
  getVaultSyncQueueSnapshot,
  processVaultSyncQueue,
  type VaultSyncQueueSnapshot,
} from "@/lib/vaultSyncQueue";
import { getAllLocalItems, loadItems, saveItems, type VaultItem } from "@/lib/vaultModel";
import { fetchVaultItemsFromSupabase, hasSupabaseEnv, upsertVaultItemToSupabase } from "@/lib/vaultCloud";
import { emitVaultUpdate } from "@/lib/vaultEvents";

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
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div
      id={id}
      className={[
        "rounded-[14px] bg-[color:var(--surface)] ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

function RowCard({ children }: { children: React.ReactNode }) {
  return <div className="rounded-[14px] bg-[color:var(--pill)] p-3 ring-1 ring-[color:var(--border)]">{children}</div>;
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

  // EK's ask (2026-09-18), after the enforce_vault_item_limit() trigger bug:
  // the queue above only ever catches an edit that KNEW it failed (went
  // offline, or a caller explicitly enqueued it). That bug's failures never
  // got that chance — the device was online the whole time, the save just
  // silently rejected server-side, so nothing was ever queued to retry.
  // This is the one thing the queue view alone can't catch: a plain item-
  // count comparison, independent of the queue, so a silent server-side
  // failure like that one doesn't require anyone to notice on their own.
  const [localTotal, setLocalTotal] = useState<number | null>(null);
  const [cloudTotal, setCloudTotal] = useState<number | null>(null);
  const [deviceOnlyItems, setDeviceOnlyItems] = useState<VaultItem[]>([]);
  const [reviewLoading, setReviewLoading] = useState(true);
  const [reviewBusyId, setReviewBusyId] = useState("");
  const [reviewStatus, setReviewStatus] = useState("");
  const [removeCandidate, setRemoveCandidate] = useState<VaultItem | null>(null);
  const dialogRef = useDialogA11y<HTMLDivElement>(removeCandidate !== null, () => setRemoveCandidate(null));

  const refresh = useCallback(() => {
    setSnapshot(readSnapshot());
  }, []);

  const refreshTotals = useCallback(async () => {
    const local = loadItems();
    setLocalTotal(local.length);
    if (!hasSupabaseEnv()) return;
    try {
      const cloud = await fetchVaultItemsFromSupabase();
      setCloudTotal(cloud.length);
      const cloudIds = new Set(cloud.map((item) => String(item.id)));
      setDeviceOnlyItems(local.filter((item) => !cloudIds.has(String(item.id))));
    } catch {
      setCloudTotal(null);
    } finally {
      setReviewLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    void refreshTotals();

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
  }, [refresh, refreshTotals]);

  const totalsDrift =
    localTotal != null && cloudTotal != null ? Math.max(0, localTotal - cloudTotal) : null;

  async function handleUploadOne(item: VaultItem) {
    if (reviewBusyId) return;
    setReviewBusyId(String(item.id));
    setReviewStatus("");
    try {
      await upsertVaultItemToSupabase(item);
      await refreshTotals();
      setReviewStatus(`Uploaded “${item.title || "Untitled item"}” to the cloud.`);
    } catch (e) {
      setReviewStatus(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setReviewBusyId("");
    }
  }

  function handleRemoveLocal() {
    if (!removeCandidate) return;
    const id = String(removeCandidate.id);
    saveItems(getAllLocalItems().filter((item) => String(item.id) !== id));
    emitVaultUpdate();
    setRemoveCandidate(null);
    setReviewStatus("Removed the device-only copy. No cloud record was changed.");
    void refreshTotals();
  }

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
    <>
    <PageHeader
      title="Offline capture queue"
      description="Review the item records and local images waiting to sync from this device."
      contentClassName="max-w-6xl"
      actions={<PillButton href="/vault">Back to Vault</PillButton>}
    />
    <main className="bg-[color:var(--bg)] text-[color:var(--fg)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col px-4 pb-5 sm:px-6 sm:pb-8">
        <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
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
                <div className="mt-3 rounded-[14px] bg-[color:var(--pill)] px-4 py-3 text-sm ring-1 ring-[color:var(--border)]">
                  {status}
                </div>
              ) : null}

              {/* Small, separate from the queue above on purpose — catches an
                  item that silently failed server-side without ever being
                  queued (see the comment on refreshTotals above). */}
              <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--border)" }}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-[color:var(--muted)]">
                    {localTotal == null || cloudTotal == null
                      ? "Checking device vs. cloud totals..."
                      : totalsDrift
                        ? `${totalsDrift} item${totalsDrift === 1 ? "" : "s"} on this device ${totalsDrift === 1 ? "hasn't" : "haven't"} reached the cloud.`
                        : `All ${localTotal} items on this device match the cloud. ✓`}
                  </div>
                  {totalsDrift ? <a href="#device-only" className="text-xs font-semibold underline underline-offset-2">Review records</a> : null}
                </div>
                <p className="mt-2 text-xs text-[color:var(--muted2)]">VLTD will never bulk-upload unmatched records. Review each one so deleted test data cannot return.</p>
              </div>
            </SurfaceCard>

            <SurfaceCard className="p-4 sm:p-5">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">Add More</div>
              <div className="mt-4 grid gap-2">
                <Link className="rounded-[14px] bg-[color:var(--pill)] px-4 py-3 text-sm ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill-hover)]" href="/capture">
                  Smart Scan camera
                </Link>
                <Link className="rounded-[14px] bg-[color:var(--pill)] px-4 py-3 text-sm ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill-hover)]" href="/vault/quick">
                  Quick add
                </Link>
                <Link className="rounded-[14px] bg-[color:var(--pill)] px-4 py-3 text-sm ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill-hover)]" href="/vault/import">
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

          <SurfaceCard className="p-4 sm:p-5" id="device-only">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">Device-only records</div>
                <div className="mt-1 text-sm text-[color:var(--muted)]">Choose one record at a time: upload a real collectible, or remove an obsolete local copy.</div>
              </div>
              <div className="text-sm text-[color:var(--muted)]">{reviewLoading ? "Checking…" : `${deviceOnlyItems.length} to review`}</div>
            </div>

            {reviewStatus ? <div className="mt-4 rounded-[14px] bg-[color:var(--pill)] px-4 py-3 text-sm ring-1 ring-[color:var(--border)]">{reviewStatus}</div> : null}

            <div className="mt-4 space-y-3">
              {!reviewLoading && deviceOnlyItems.length === 0 ? (
                <RowCard><div className="text-sm text-[color:var(--muted)]">No device-only records. This device and the cloud contain the same item IDs.</div></RowCard>
              ) : (
                deviceOnlyItems.map((item) => (
                  <RowCard key={item.id}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{item.title || "Untitled item"}</div>
                        <div className="mt-1 text-xs text-[color:var(--muted)]">{item.status || "COLLECTION"} · ID {item.id}</div>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <PillButton href={`/vault/item/${item.id}`}>Review item</PillButton>
                        <PillButton onClick={() => void handleUploadOne(item)} disabled={Boolean(reviewBusyId)}>{reviewBusyId === String(item.id) ? "Uploading…" : "Keep and upload"}</PillButton>
                        <PillButton variant="danger" onClick={() => setRemoveCandidate(item)} disabled={Boolean(reviewBusyId)}>Remove local copy</PillButton>
                      </div>
                    </div>
                  </RowCard>
                ))
              )}
            </div>
          </SurfaceCard>
        </div>
      </div>

      {removeCandidate ? (
        <div className="fixed inset-0 z-[10000] grid place-items-center bg-black/70 px-4" onClick={(event) => { if (event.target === event.currentTarget) setRemoveCandidate(null); }}>
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Remove device-only record" className="w-full max-w-md rounded-[14px] bg-[color:var(--surface)] p-5 ring-1 ring-[color:var(--border)]">
            <h2 className="text-lg font-semibold">Remove this local copy?</h2>
            <p className="mt-2 text-sm text-[color:var(--muted)]">“{removeCandidate.title || "Untitled item"}” is not in the cloud. This removes it only from this browser and cannot be undone here.</p>
            <div className="mt-5 flex justify-end gap-2">
              <PillButton onClick={() => setRemoveCandidate(null)}>Cancel</PillButton>
              <PillButton variant="danger" onClick={handleRemoveLocal}>Remove local copy</PillButton>
            </div>
          </div>
        </div>
      ) : null}
    </main>
    </>
  );
}
