"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { isOwnerEmail } from "@/lib/ownerAccess";
import { getAllLocalItems } from "@/lib/vaultModel";
import { syncAllItemsToCloud, restoreLocalVaultFromCloud } from "@/lib/vaultSyncQueue";
import { fetchVaultItemsFromSupabase } from "@/lib/vaultCloud";
import { hasSupabaseEnv } from "@/lib/vaultCloud";

export default function BackupPage() {
  const [access, setAccess] = useState<"checking" | "allowed" | "blocked">("checking");
  const [localCount, setLocalCount] = useState<number | null>(null);
  const [cloudCount, setCloudCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function refreshCounts() {
    setLocalCount(getAllLocalItems().length);
    if (hasSupabaseEnv()) {
      try {
        const cloud = await fetchVaultItemsFromSupabase();
        setCloudCount(cloud.length);
      } catch {
        setCloudCount(null);
      }
    }
  }

  useEffect(() => {
    let active = true;
    async function loadAccess() {
      const userResult = await getCurrentUser();
      const allowed = isOwnerEmail(userResult.data.user?.email);
      if (!active) return;
      setAccess(allowed ? "allowed" : "blocked");
      if (allowed) void refreshCounts();
    }
    void loadAccess();
    return () => {
      active = false;
    };
  }, []);

  async function handleBackup() {
    if (busy) return;
    setBusy(true);
    setResult(null);
    try {
      const r = await syncAllItemsToCloud();
      await refreshCounts();
      if (r.remaining > 0) {
        setResult({
          ok: false,
          message: `Uploaded ${r.processed} of ${r.total}. ${r.remaining} still pending — check your connection and run it again.`,
        });
      } else {
        setResult({
          ok: true,
          message: `Done — all ${r.total} items are backed up to the cloud.`,
        });
      }
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : "Backup failed." });
    } finally {
      setBusy(false);
    }
  }

  const drift =
    localCount != null && cloudCount != null ? Math.max(0, localCount - cloudCount) : null;

  if (access !== "allowed") {
    return (
      <main className="min-h-dvh bg-[color:var(--bg)] px-4 py-10 text-[color:var(--fg)]">
        <div className="mx-auto w-full max-w-md rounded-2xl bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)]">
          <div className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--muted2)]">VLTD</div>
          <h1 className="mt-1 text-2xl font-semibold">Backup tools locked</h1>
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            {access === "checking"
              ? "Checking account access..."
              : "Manual cloud backup and restore are limited while VLTD is in beta."}
          </p>
          <Link href="/more" className="mt-5 inline-flex text-sm text-[color:var(--muted)] underline underline-offset-2">
            Back to command center
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[color:var(--bg)] px-4 py-10 text-[color:var(--fg)]">
      <div className="mx-auto w-full max-w-md">
        <div className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--muted2)]">VLTD</div>
        <h1 className="mt-1 text-2xl font-semibold">Cloud Backup</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          Push every item to the cloud so nothing lives only in this browser. Your items sync
          automatically as you go — this is a manual catch-up for anything that hasn&apos;t made it up yet.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-[color:var(--surface)] p-4 text-center ring-1 ring-[color:var(--border)]">
            <div className="text-2xl font-bold">{localCount ?? "…"}</div>
            <div className="mt-0.5 text-[11px] text-[color:var(--muted)]">On this device</div>
          </div>
          <div className="rounded-2xl bg-[color:var(--surface)] p-4 text-center ring-1 ring-[color:var(--border)]">
            <div className="text-2xl font-bold">{cloudCount ?? "…"}</div>
            <div className="mt-0.5 text-[11px] text-[color:var(--muted)]">In the cloud</div>
          </div>
        </div>

        {drift != null && drift > 0 ? (
          <div className="mt-3 rounded-xl bg-amber-500/10 px-4 py-3 text-sm ring-1 ring-amber-400/25" style={{ color: "#f5c451" }}>
            {drift} item{drift === 1 ? "" : "s"} on this device {drift === 1 ? "isn't" : "aren't"} backed up yet.
          </div>
        ) : drift === 0 ? (
          <div className="mt-3 rounded-xl bg-[rgba(74,222,128,0.10)] px-4 py-3 text-sm ring-1 ring-[rgba(74,222,128,0.3)]" style={{ color: "#4ade80" }}>
            Everything on this device is backed up. ✓
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleBackup}
          disabled={busy}
          className="mt-5 flex h-12 w-full items-center justify-center rounded-[8px] text-sm font-bold transition disabled:opacity-40"
          style={{ background: "linear-gradient(135deg, #8C9298, #C8CDD2)", color: "#0B0B0B", boxShadow: "0 4px 18px rgba(203,208,213,0.28)" }}
        >
          {busy ? "Backing up…" : "Back up all items to cloud"}
        </button>

        {result ? (
          <div
            className="mt-3 rounded-xl px-4 py-3 text-sm ring-1"
            style={
              result.ok
                ? { background: "rgba(74,222,128,0.10)", color: "#4ade80", borderColor: "rgba(74,222,128,0.3)" }
                : { background: "rgba(248,113,113,0.10)", color: "#f87171", borderColor: "rgba(248,113,113,0.3)" }
            }
          >
            {result.message}
          </div>
        ) : null}

        <p className="mt-4 text-center text-xs text-[color:var(--muted2)]">
          Safe to run any time — items are updated in place, never deleted. You must be signed in.
        </p>

        {/* Recovery — pull authoritative cloud data down, replacing the local cache */}
        <div className="mt-6 rounded-2xl bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)]">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[color:var(--muted2)]">
            Restore from cloud
          </div>
          <p className="mt-1 text-xs text-[color:var(--muted)]">
            Replaces this device&apos;s copy of the <b>active profile</b> with what&apos;s in the cloud.
            Use this if items look mis-assigned. Switch to the profile you want to restore first.
          </p>
          <button
            type="button"
            onClick={async () => {
              if (busy) return;
              if (!window.confirm("Replace this device's local copy of the active profile with the cloud version?")) return;
              setBusy(true);
              setResult(null);
              try {
                const r = await restoreLocalVaultFromCloud();
                await refreshCounts();
                setResult({ ok: true, message: `Restored ${r.pulled} items from the cloud.` });
              } catch (e) {
                setResult({ ok: false, message: e instanceof Error ? e.message : "Restore failed." });
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy}
            className="mt-3 flex h-10 w-full items-center justify-center rounded-[8px] text-sm font-semibold ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill)] disabled:opacity-40"
            style={{ color: "var(--fg)" }}
          >
            Restore active profile from cloud
          </button>
        </div>

        <div className="mt-6 text-center">
          <Link href="/vault" className="text-sm text-[color:var(--muted)] underline underline-offset-2">
            Back to vault
          </Link>
        </div>
      </div>
    </main>
  );
}
