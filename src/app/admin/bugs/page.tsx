"use client";

import { useCallback, useEffect, useState } from "react";
import { getMyAdminRole, type AdminRole } from "@/lib/adminAuth";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type BugRow = {
  id: string;
  email: string | null;
  message: string;
  screenshot_url: string | null;
  page_path: string | null;
  user_agent: string | null;
  status: string;
  created_at: string | null;
  admin_reply: string | null;
  admin_replied_at: string | null;
};

function formatDateTime(value: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
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

export default function AdminBugsPage() {
  const [role, setRole] = useState<AdminRole | "loading">("loading");
  const [rows, setRows] = useState<BugRow[]>([]);
  const [status, setStatus] = useState("");
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);

  const loadRows = useCallback(async () => {
    setStatus("Loading…");
    try {
      const res = await fetch("/api/admin/bugs", { headers: await authHeader() });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data.message || "Failed to load reports.");
        return;
      }
      setRows(data.rows ?? []);
      setStatus("");
    } catch {
      setStatus("Couldn't load reports. Try again.");
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const myRole = await getMyAdminRole();
      setRole(myRole);
      if (myRole) await loadRows();
    })();
  }, [loadRows]);

  async function setRowStatus(id: string, next: "open" | "resolved") {
    try {
      const res = await fetch("/api/admin/bugs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ id, status: next }),
      });
      if (res.ok) await loadRows();
    } catch {
      /* no-op */
    }
  }

  async function sendReply(id: string) {
    const reply = (drafts[id] ?? "").trim();
    if (!reply) return;
    setSendingId(id);
    try {
      const res = await fetch("/api/admin/bugs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ id, reply }),
      });
      if (res.ok) {
        setDrafts((prev) => ({ ...prev, [id]: "" }));
        await loadRows();
      }
    } catch {
      /* no-op */
    } finally {
      setSendingId(null);
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

  const shown = filter === "open" ? rows.filter((r) => r.status !== "resolved") : rows;

  return (
    <main className="px-4 py-8 text-[color:var(--fg)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-[-0.03em]">Bug Reports</h1>
            <p className="mt-1 text-sm text-[color:var(--muted)]">Feedback submitted from the in-app reporter.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFilter(filter === "open" ? "all" : "open")}
              className="h-10 rounded-full border border-[color:var(--border)] bg-[color:var(--pill)] px-4 text-sm font-semibold text-[color:var(--muted)] transition hover:text-text-primary"
            >
              {filter === "open" ? "Showing open" : "Showing all"}
            </button>
            <button
              type="button"
              onClick={() => void loadRows()}
              className="h-10 rounded-full border border-[color:var(--border)] bg-[color:var(--pill)] px-4 text-sm font-semibold text-[color:var(--muted)] transition hover:text-text-primary"
            >
              Refresh
            </button>
          </div>
        </div>

        {status && (
          <div className="mt-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-sm text-[color:var(--muted)]">
            {status}
          </div>
        )}

        <div className="mt-6 space-y-3">
          {shown.length === 0 ? (
            <div className="rounded-2xl border border-[color:var(--border)] bg-vault-card p-8 text-center text-[color:var(--muted)]">
              No reports.
            </div>
          ) : (
            shown.map((r) => (
              <div key={r.id} className="rounded-2xl border border-[color:var(--border)] bg-vault-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-text-primary">{r.email || "Anonymous"}</div>
                    <div className="text-xs text-[color:var(--muted2)]">
                      {formatDateTime(r.created_at)}{r.page_path ? ` · ${r.page_path}` : ""}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {r.status === "resolved" ? (
                      <span className="rounded-full bg-emerald-500/12 px-2.5 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-400/25">Resolved</span>
                    ) : (
                      <span className="rounded-full bg-amber-400/12 px-2.5 py-1 text-xs font-semibold text-amber-200 ring-1 ring-amber-300/25">Open</span>
                    )}
                    <button
                      type="button"
                      onClick={() => void setRowStatus(r.id, r.status === "resolved" ? "open" : "resolved")}
                      className="rounded-full border border-[color:var(--border)] bg-[color:var(--pill)] px-3 py-1 text-xs font-semibold text-[color:var(--muted)] transition hover:text-text-primary"
                    >
                      {r.status === "resolved" ? "Reopen" : "Resolve"}
                    </button>
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[color:var(--fg)]">{r.message}</p>
                {r.screenshot_url && (
                  <a href={r.screenshot_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.screenshot_url} alt="screenshot" className="max-h-48 rounded-xl border border-[color:var(--border)]" />
                  </a>
                )}

                {r.admin_reply && (
                  <div className="mt-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--pill)] p-3">
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--muted2)]">
                      Your reply{r.admin_replied_at ? ` · ${formatDateTime(r.admin_replied_at)}` : ""}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[color:var(--fg)]">{r.admin_reply}</p>
                  </div>
                )}

                <div className="mt-3 flex items-end gap-2">
                  <textarea
                    value={drafts[r.id] ?? ""}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    placeholder={r.admin_reply ? "Update your reply…" : "Reply to the reporter — they'll see this in their Alerts…"}
                    rows={2}
                    className="flex-1 resize-none rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--fg)] placeholder:text-[color:var(--muted2)] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void sendReply(r.id)}
                    disabled={sendingId === r.id || !(drafts[r.id] ?? "").trim()}
                    className="h-9 shrink-0 rounded-full border border-[color:var(--border)] bg-[color:var(--pill)] px-4 text-sm font-semibold text-[color:var(--fg)] transition hover:brightness-110 disabled:opacity-50"
                  >
                    {sendingId === r.id ? "Sending…" : "Reply"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
