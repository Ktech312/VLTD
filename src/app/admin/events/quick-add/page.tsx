"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getMyAdminRole, type AdminRole } from "@/lib/adminAuth";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { parseDateRangeFromText, stripTrailingDateText } from "@/lib/events/parseDatesFromText";

async function authHeader(): Promise<Record<string, string>> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return {};
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function QuickAddForm() {
  const params = useSearchParams();
  const [role, setRole] = useState<AdminRole | "loading">("loading");
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [city, setCity] = useState("");
  const [link, setLink] = useState("");
  const [shortDesc, setShortDesc] = useState("");
  const [status, setStatus] = useState("");
  const [datesGuessed, setDatesGuessed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => setRole(await getMyAdminRole()))();
  }, []);

  useEffect(() => {
    const rawName = params.get("name") ?? "";
    const desc = params.get("desc") ?? "";

    // Try the title first (dates usually live there -- "Event - Jan 1-4"),
    // fall back to the highlighted-text description. Purely local, no AI/API
    // call -- this tool exists specifically to work without either.
    const parsed = parseDateRangeFromText(rawName) ?? parseDateRangeFromText(desc);

    setName(parsed ? stripTrailingDateText(rawName, parsed) : rawName);
    setLink(params.get("link") ?? "");
    setShortDesc(desc);
    setDatesGuessed(Boolean(parsed));
    if (parsed) {
      setStartDate(parsed.startDate);
      setEndDate(parsed.endDate);
    }
  }, [params]);

  async function save() {
    setStatus("");
    if (!name.trim() || !startDate) {
      setStatus("Name and start date are required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/events/quick-add", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ name, startDate, endDate, city, link, shortDesc }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data.message || "Failed to save.");
      } else {
        setStatus("Saved — it'll show up on the Events page right away.");
      }
    } catch {
      setStatus("Failed to save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (role === "loading") {
    return (
      <main className="px-4 py-10 text-[color:var(--fg)]">
        <div className="mx-auto max-w-lg text-[color:var(--muted)]">Checking access…</div>
      </main>
    );
  }

  if (!role) {
    return (
      <main className="px-4 py-10 text-[color:var(--fg)]">
        <div className="mx-auto max-w-lg rounded-2xl border border-[color:var(--border)] bg-vault-card p-6 text-[color:var(--muted)]">
          You don&apos;t have access to this page.
        </div>
      </main>
    );
  }

  return (
    <main className="px-4 py-8 text-[color:var(--fg)] sm:px-6">
      <div className="mx-auto max-w-lg">
        <h1 className="text-2xl font-black tracking-[-0.03em]">Quick Add Event</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          The manual fallback — found something by hand, add it straight to the Events page.
        </p>

        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[color:var(--muted)]">Event name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--pill)] px-3 text-sm outline-none"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[color:var(--muted)]">Start date</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDatesGuessed(false);
                }}
                className="h-11 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--pill)] px-3 text-sm outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[color:var(--muted)]">End date (optional)</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDatesGuessed(false);
                }}
                className="h-11 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--pill)] px-3 text-sm outline-none"
              />
            </label>
          </div>
          {datesGuessed && (
            <p className="-mt-1 text-xs text-[color:var(--theme-gold)]">
              Guessed from the title — double-check before saving.
            </p>
          )}

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[color:var(--muted)]">City / State (optional)</span>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="h-11 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--pill)] px-3 text-sm outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[color:var(--muted)]">Link</span>
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              className="h-11 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--pill)] px-3 text-sm outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[color:var(--muted)]">Description (optional)</span>
            <textarea
              value={shortDesc}
              onChange={(e) => setShortDesc(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--pill)] px-3 py-2 text-sm outline-none"
            />
          </label>

          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="vltd-primary-button h-11 w-full rounded-lg text-sm font-black disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save event"}
          </button>

          {status && <div className="text-sm text-[color:var(--muted)]">{status}</div>}
        </div>
      </div>
    </main>
  );
}

export default function AdminEventsQuickAddPage() {
  return (
    <Suspense fallback={null}>
      <QuickAddForm />
    </Suspense>
  );
}
