"use client";

import { useCallback, useEffect, useState } from "react";
import { getMyAdminRole, type AdminRole } from "@/lib/adminAuth";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { timeAgo, exactDateTime, formatDuration, averageSessionLength } from "@/lib/presence";

type UserRow = {
  id: string;
  displayName: string | null;
  username: string | null;
  email: string | null;
  createdAt: string | null;
  lastSeenAt: string | null;
  totalSecondsOnline: number;
  sessionCount: number;
  aiCalls: number;
  aiInputTokens: number;
  aiOutputTokens: number;
  museumBetaEnabled: boolean;
  museumBetaRequestedAt: string | null;
};

function formatJoined(value: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "—";
  }
}

async function authHeader(): Promise<Record<string, string>> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return {};
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function AdminUsersPage() {
  const [role, setRole] = useState<AdminRole | "loading">("loading");
  const [rows, setRows] = useState<UserRow[]>([]);
  const [status, setStatus] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadRows = useCallback(async () => {
    setStatus("Loading…");
    try {
      const res = await fetch("/api/admin/users", { headers: await authHeader() });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data.message || "Failed to load users.");
        return;
      }
      setRows(data.rows ?? []);
      setStatus("");
    } catch {
      setStatus("Couldn't load users. Try again.");
    }
  }, []);

  async function toggleMuseumBeta(row: UserRow) {
    setTogglingId(row.id);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ profileId: row.id, museumBetaEnabled: !row.museumBetaEnabled }),
      });
      if (res.ok) {
        setRows((current) =>
          current.map((r) => (r.id === row.id ? { ...r, museumBetaEnabled: !r.museumBetaEnabled } : r))
        );
      }
    } finally {
      setTogglingId(null);
    }
  }

  useEffect(() => {
    void (async () => {
      const myRole = await getMyAdminRole();
      setRole(myRole);
      if (myRole) await loadRows();
    })();
  }, [loadRows]);

  if (role === "loading") {
    return (
      <main className="px-4 py-10 text-[color:var(--fg)]">
        <div className="mx-auto max-w-3xl text-[color:var(--muted)]">Checking access…</div>
      </main>
    );
  }

  if (!role) {
    return (
      <main className="px-4 py-10 text-[color:var(--fg)]">
        <div className="mx-auto max-w-3xl rounded-2xl border border-[color:var(--border)] bg-vault-card p-6 text-[color:var(--muted)]">
          You don&apos;t have access to this page.
        </div>
      </main>
    );
  }

  const totalAiCalls = rows.reduce((sum, r) => sum + r.aiCalls, 0);
  const totalTokens = rows.reduce((sum, r) => sum + r.aiInputTokens + r.aiOutputTokens, 0);

  return (
    <main className="px-4 py-8 text-[color:var(--fg)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-[-0.03em]">Users</h1>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              {rows.length} account{rows.length === 1 ? "" : "s"} · {totalAiCalls} AI calls ·{" "}
              {totalTokens.toLocaleString()} tokens total
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadRows()}
            className="h-10 shrink-0 rounded-full border border-[color:var(--border)] bg-[color:var(--pill)] px-4 text-sm font-semibold text-[color:var(--muted)] transition hover:text-text-primary"
          >
            Refresh
          </button>
        </div>

        {status && (
          <div className="mt-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-sm text-[color:var(--muted)]">
            {status}
          </div>
        )}

        <div className="mt-6 overflow-x-auto rounded-2xl border border-[color:var(--border)]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] text-[color:var(--muted2)]">
                <th className="px-4 py-3 font-semibold">Account</th>
                <th className="px-4 py-3 font-semibold">Joined</th>
                <th className="px-4 py-3 font-semibold">Last active</th>
                <th className="px-4 py-3 font-semibold">Sessions</th>
                <th className="px-4 py-3 font-semibold">Total time</th>
                <th className="px-4 py-3 font-semibold">Avg session</th>
                <th className="px-4 py-3 font-semibold">AI calls</th>
                <th className="px-4 py-3 font-semibold">AI tokens</th>
                <th className="px-4 py-3 font-semibold">3D Museum beta</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-[color:var(--muted)]">No accounts yet.</td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-b border-[color:var(--border)] last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium text-text-primary">{r.displayName || r.username || "Unnamed"}</div>
                      <div className="text-xs text-[color:var(--muted)]">{r.email || "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-[color:var(--muted)]">{formatJoined(r.createdAt)}</td>
                    <td className="px-4 py-3 text-[color:var(--muted)]" title={exactDateTime(r.lastSeenAt)}>
                      {timeAgo(r.lastSeenAt)}
                    </td>
                    <td className="px-4 py-3 text-[color:var(--muted)]">{r.sessionCount}</td>
                    <td className="px-4 py-3 text-[color:var(--muted)]">{formatDuration(r.totalSecondsOnline)}</td>
                    <td className="px-4 py-3 text-[color:var(--muted)]">
                      {averageSessionLength(r.totalSecondsOnline, r.sessionCount)}
                    </td>
                    <td className="px-4 py-3 text-[color:var(--muted)]">{r.aiCalls}</td>
                    <td className="px-4 py-3 text-[color:var(--muted)]">
                      {(r.aiInputTokens + r.aiOutputTokens).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => void toggleMuseumBeta(r)}
                        disabled={togglingId === r.id}
                        className={[
                          "inline-flex h-7 items-center rounded-full px-3 text-xs font-semibold transition disabled:opacity-50",
                          r.museumBetaEnabled
                            ? "bg-[#4FD3EE] text-[#06171d]"
                            : "border border-[color:var(--border)] bg-[color:var(--pill)] text-[color:var(--muted)]",
                        ].join(" ")}
                        title={
                          r.museumBetaRequestedAt
                            ? `Requested ${formatJoined(r.museumBetaRequestedAt)}`
                            : "Not requested"
                        }
                      >
                        {r.museumBetaEnabled ? "Enabled" : r.museumBetaRequestedAt ? "Requested" : "Off"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
