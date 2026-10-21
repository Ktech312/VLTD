"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { PillButton } from "@/components/ui/PillButton";
import { INSIGHTS_AMBER } from "@/lib/insightsPalette";
import { resetCloudBackoff, syncVaultItemsFromSupabaseChecked } from "@/lib/vaultModel";

/** The one sentence shown when saved items are on screen because the cloud could not be reached. */
export const STALE_MESSAGE = "Showing saved data—couldn’t refresh.";
/** How long a page waits for the cloud before it says it could not refresh (the Vault uses the same 20 s). */
export const CLOUD_WAIT_MS = 20_000;

const amberBorder = "1px solid rgba(227,179,65,0.40)";

/** Compact notice above saved data. Pending uploads have their own status elsewhere; this only says the refresh failed. */
export function StaleDataNotice({ onRetry, busy = false }: { onRetry: () => void; busy?: boolean }) {
  return (
    <div role="status" data-testid="stale-notice" className="mb-3 flex flex-wrap items-center gap-2 rounded-[8px] px-3 py-1.5 text-[12px]" style={{ background: "rgba(227,179,65,0.08)", border: amberBorder, color: "var(--fg)" }}>
      <span className="font-semibold vltd-keep-color" style={{ "--vltd-keep-color": INSIGHTS_AMBER } as React.CSSProperties}>{STALE_MESSAGE}</span>
      <PillButton size="compact" onClick={onRetry} disabled={busy}>{busy ? "Retrying…" : "Retry"}</PillButton>
    </div>
  );
}

/** Shown instead of a list when nothing is saved on this device and the cloud did not answer: a failed load, never an empty collection. */
export function LoadErrorCard({ what, onRetry, busy = false }: { what: string; onRetry: () => void; busy?: boolean }) {
  return (
    <div role="alert" className="rounded-[8px] px-6 py-8 text-center ring-1 ring-[color:var(--border)]" style={{ background: "var(--surface)" }}>
      <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">COULD NOT LOAD</div>
      <div className="mt-2 text-base font-semibold" style={{ color: "var(--fg)" }}>We couldn&apos;t load your {what} just now</div>
      <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>Your items are safe: nothing has been changed or lost. Check your connection and retry.</p>
      <div className="mt-4 flex justify-center"><PillButton variant="primary" onClick={onRetry} disabled={busy}>{busy ? "Retrying…" : "Retry"}</PillButton></div>
    </div>
  );
}

/** What a page shows in place of an empty list until the cloud has answered: a short wait note, or the could-not-load card with Retry. */
export function CloudWait({ what, cloud }: { what: string; cloud: { state: CloudState; busy: boolean; retry: () => void } }) {
  return (
    <main className="no-print mx-auto max-w-3xl px-4 py-10">
      {cloud.state === "failed" ? (
        <LoadErrorCard what={what} onRetry={cloud.retry} busy={cloud.busy} />
      ) : (
        <div role="status" className="rounded-[8px] px-6 py-8 text-center text-sm ring-1 ring-[color:var(--border)]" style={{ background: "var(--surface)", color: "var(--muted)" }}>Loading your {what}…</div>
      )}
    </main>
  );
}

export type CloudState = "loading" | "ok" | "failed";

/**
 * Asks the cloud once for the page's data (bounded by CLOUD_WAIT_MS) and tells the page which of three things is true.
 * `reload` re-reads the saved copy. Retry clears the automatic-download wait first, so a person is never made to wait.
 */
export function useCloudRefresh(reload: () => void) {
  const [state, setState] = useState<CloudState>("loading");
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  const reloadRef = useRef(reload);
  reloadRef.current = reload;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const run = useCallback(async () => {
    const ok = await Promise.race([
      syncVaultItemsFromSupabaseChecked().then((r) => r.ok).catch(() => false),
      new Promise<boolean>((resolve) => window.setTimeout(() => resolve(false), CLOUD_WAIT_MS)),
    ]);
    if (!alive.current) return;
    reloadRef.current();
    setState(ok ? "ok" : "failed");
    setBusy(false);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => { void run(); }, 0);
    return () => window.clearTimeout(t);
  }, [run]);

  const retry = useCallback(() => {
    resetCloudBackoff();
    setBusy(true);
    setState("loading");
    void run();
  }, [run]);

  return { state, busy, retry };
}
