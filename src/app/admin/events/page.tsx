"use client";

import { useCallback, useEffect, useState } from "react";
import { getMyAdminRole, type AdminRole } from "@/lib/adminAuth";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { showToast } from "@/lib/toast";
import QuickAddEventForm from "@/components/admin/QuickAddEventForm";

type EventRow = {
  id: string;
  slug: string;
  name: string;
  starts_at: string;
  ends_at: string;
  city: string | null;
  image_url: string | null;
  website_url: string | null;
  enabled: boolean;
  is_featured: boolean;
  created_at: string;
};

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
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

export default function AdminEventsPage() {
  const [role, setRole] = useState<AdminRole | "loading">("loading");
  const [rows, setRows] = useState<EventRow[]>([]);
  const [status, setStatus] = useState("");
  const [busyId, setBusyId] = useState("");
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const loadRows = useCallback(async () => {
    setStatus("Loading…");
    try {
      const res = await fetch("/api/admin/events", { headers: await authHeader() });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data.message || "Failed to load events.");
        return;
      }
      setRows(data.rows ?? []);
      setStatus("");
    } catch {
      setStatus("Couldn't load events. Try again.");
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const myRole = await getMyAdminRole();
      setRole(myRole);
      if (myRole) await loadRows();
    })();
  }, [loadRows]);

  async function toggle(row: EventRow, field: "enabled" | "isFeatured", value: boolean) {
    setBusyId(row.id);
    try {
      const res = await fetch("/api/admin/events", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ id: row.id, [field]: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.message || "Failed to update.");
        return;
      }
      setRows((current) =>
        current.map((r) =>
          r.id === row.id
            ? { ...r, ...(field === "enabled" ? { enabled: value } : { is_featured: value }) }
            : r,
        ),
      );
    } catch {
      showToast("Failed to update.");
    } finally {
      setBusyId("");
    }
  }

  async function remove(row: EventRow) {
    if (!window.confirm(`Delete "${row.name}"? This can't be undone.`)) return;
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/admin/events?id=${encodeURIComponent(row.id)}`, {
        method: "DELETE",
        headers: await authHeader(),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.message || "Failed to delete.");
        return;
      }
      setRows((current) => current.filter((r) => r.id !== row.id));
      showToast("Deleted.");
    } catch {
      showToast("Failed to delete.");
    } finally {
      setBusyId("");
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

  return (
    <main className="px-4 py-8 text-[color:var(--fg)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-[-0.03em]">Events</h1>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              Every event, including ones already hidden from the public page (past, or manually disabled).
            </p>
          </div>
          <div className="shrink-0 text-right">
            <div className="flex justify-end gap-2">
              <a
                href="https://claude.ai/code/artifact/48d46d98-8e1f-4214-84df-71399faa09b2"
                target="_blank"
                rel="noopener noreferrer"
                className="vltd-primary-button h-10 inline-flex items-center gap-1.5 rounded-full px-4 text-sm font-black"
              >
                Event Catcher <span className="text-xs">↗</span>
              </a>
              <button
                type="button"
                onClick={() => setShowQuickAdd(true)}
                className="h-10 inline-flex items-center rounded-full border border-[color:var(--theme-gold-border)] bg-[color:var(--pill)] px-4 text-sm font-semibold text-[color:var(--theme-gold)]"
              >
                + Quick Add
              </button>
              <button
                type="button"
                onClick={() => void loadRows()}
                className="h-10 shrink-0 rounded-full border border-[color:var(--border)] bg-[color:var(--pill)] px-4 text-sm font-semibold text-[color:var(--muted)] transition hover:text-text-primary"
              >
              Refresh
              </button>
            </div>
            <p className="mt-1.5 text-xs text-[color:var(--muted)]">
              Drag the bookmarklet on that page to your browser's bookmarks bar — click it on any
              webpage to grab the title, link, and photo into Quick Add.
            </p>
          </div>
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
                <th className="px-4 py-3 font-semibold">Event</th>
                <th className="px-4 py-3 font-semibold">Dates</th>
                <th className="px-4 py-3 font-semibold">City</th>
                <th className="px-4 py-3 font-semibold">Enabled</th>
                <th className="px-4 py-3 font-semibold">Featured</th>
                <th className="px-4 py-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[color:var(--muted)]">No events yet.</td>
                </tr>
              ) : (
                rows.map((r) => {
                  const isPast = new Date(r.ends_at).getTime() < Date.now();
                  return (
                    <tr key={r.id} className="border-b border-[color:var(--border)] last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {r.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element -- unknown external domain
                            <img src={r.image_url} alt="" className="h-10 w-14 shrink-0 rounded object-cover" />
                          ) : (
                            <div className="h-10 w-14 shrink-0 rounded bg-[color:var(--pill)]" />
                          )}
                          <div className="min-w-0">
                            <div className="font-medium text-text-primary">{r.name}</div>
                            {r.website_url && (
                              <a href={r.website_url} target="_blank" rel="noopener noreferrer" className="text-xs text-[color:var(--muted)] underline">
                                Link
                              </a>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[color:var(--muted)]">
                        {formatDate(r.starts_at)} – {formatDate(r.ends_at)}
                        {isPast && (
                          <span className="ml-2 rounded-full bg-[color:var(--pill)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--muted)]">
                            ended
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[color:var(--muted)]">{r.city || "—"}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => void toggle(r, "enabled", !r.enabled)}
                          className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 disabled:opacity-50"
                          style={
                            r.enabled
                              ? { background: "rgba(84,201,138,0.12)", color: "#54c98a", boxShadow: "inset 0 0 0 1px rgba(84,201,138,0.3)" }
                              : { background: "var(--pill)", color: "var(--muted)", boxShadow: "inset 0 0 0 1px var(--border)" }
                          }
                        >
                          {r.enabled ? "On" : "Off"}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => void toggle(r, "isFeatured", !r.is_featured)}
                          className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 disabled:opacity-50"
                          style={
                            r.is_featured
                              ? { background: "var(--theme-gold-soft, rgba(217,185,104,0.14))", color: "var(--theme-gold)", boxShadow: "inset 0 0 0 1px var(--theme-gold-border)" }
                              : { background: "var(--pill)", color: "var(--muted)", boxShadow: "inset 0 0 0 1px var(--border)" }
                          }
                        >
                          {r.is_featured ? "Featured" : "—"}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => void remove(r)}
                          className="inline-flex h-8 items-center rounded-full border border-[color:var(--border)] bg-[color:var(--pill)] px-3 text-xs font-semibold text-red-300 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showQuickAdd && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-10"
          onClick={() => setShowQuickAdd(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg)] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-black tracking-[-0.02em]">Quick Add Event</h2>
              <button
                type="button"
                onClick={() => setShowQuickAdd(false)}
                className="shrink-0 rounded-full p-1 text-[color:var(--muted)] transition hover:text-text-primary"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="mt-4">
              <QuickAddEventForm
                onSaved={() => {
                  setShowQuickAdd(false);
                  void loadRows();
                }}
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
