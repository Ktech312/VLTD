"use client";

import { useCallback, useEffect, useState } from "react";
import { getMyAdminRole, type AdminRole } from "@/lib/adminAuth";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type WaitlistRow = {
  id: string;
  email: string;
  note: string | null;
  source: string | null;
  created_at: string | null;
  invited_at: string | null;
  consented_at: string | null;
};

function formatDate(value: string | null) {
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

export default function AdminWaitlistPage() {
  const [role, setRole] = useState<AdminRole | "loading">("loading");
  const [rows, setRows] = useState<WaitlistRow[]>([]);
  const [status, setStatus] = useState("");
  const [invitingEmail, setInvitingEmail] = useState("");

  const loadRows = useCallback(async () => {
    setStatus("Loading…");
    try {
      const res = await fetch("/api/admin/waitlist", { headers: await authHeader() });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data.message || "Failed to load waitlist.");
        return;
      }
      setRows(data.rows ?? []);
      setStatus("");
    } catch {
      setStatus("Couldn't load the waitlist. Try again.");
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const myRole = await getMyAdminRole();
      setRole(myRole);
      if (myRole) await loadRows();
    })();
  }, [loadRows]);

  async function invite(email: string) {
    setInvitingEmail(email);
    setStatus("");
    try {
      const res = await fetch("/api/admin/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data.message || "Invite failed.");
      } else {
        setStatus(data.message || "Invite sent.");
        await loadRows();
      }
    } catch {
      setStatus("Invite failed. Try again.");
    } finally {
      setInvitingEmail("");
    }
  }

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

  const pending = rows.filter((r) => !r.invited_at);
  const invited = rows.filter((r) => r.invited_at);

  return (
    <main className="px-4 py-8 text-[color:var(--fg)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-[-0.03em]">Beta Waitlist</h1>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              Approve requests to send a Supabase invite email. {pending.length} pending · {invited.length} invited.
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

        <div className="mt-6 overflow-hidden rounded-2xl border border-[color:var(--border)]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] text-[color:var(--muted2)]">
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Requested</th>
                <th className="px-4 py-3 font-semibold">Consent</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[color:var(--muted)]">No requests yet.</td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-b border-[color:var(--border)] last:border-0">
                    <td className="px-4 py-3 font-medium text-text-primary">{r.email}</td>
                    <td className="px-4 py-3 text-[color:var(--muted)]">{formatDate(r.created_at)}</td>
                    <td className="px-4 py-3 text-[color:var(--muted)]">{r.consented_at ? "✓" : "—"}</td>
                    <td className="px-4 py-3">
                      {r.invited_at ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-500/12 px-2.5 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-400/25">
                          Invited {formatDate(r.invited_at)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-[color:var(--pill)] px-2.5 py-1 text-xs font-semibold text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={invitingEmail === r.email}
                        onClick={() => void invite(r.email)}
                        className="inline-flex h-9 items-center rounded-full px-4 text-xs font-black text-[#0B0B0B] transition hover:brightness-105 disabled:opacity-50"
                        style={{ background: "var(--theme-gold-gradient)", boxShadow: "var(--theme-gold-glow)" }}
                      >
                        {invitingEmail === r.email ? "Sending…" : r.invited_at ? "Re-invite" : "Approve & Invite"}
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
