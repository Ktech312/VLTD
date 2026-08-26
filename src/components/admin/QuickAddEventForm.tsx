"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { parseDateRangeFromText, stripTrailingDateText } from "@/lib/events/parseDatesFromText";
import { showToast } from "@/lib/toast";

async function authHeader(): Promise<Record<string, string>> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return {};
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Shared by both hosts: the standalone /admin/events/quick-add page (the
// bookmarklet's window.open target -- has to be a real URL, a modal can't
// be opened from an external page) and the compact modal on /admin/events
// itself (triggered by clicking "+ Quick Add" while already in the app).
export default function QuickAddEventForm({
  initialName = "",
  initialLink = "",
  initialDesc = "",
  initialImage = "",
  onSaved,
}: {
  initialName?: string;
  initialLink?: string;
  initialDesc?: string;
  initialImage?: string;
  onSaved: (slug: string) => void;
}) {
  // Dates usually live in the title ("Event - Jan 1-4"), fall back to the
  // highlighted-text description. Purely local, no AI/API call -- this
  // tool exists specifically to work without either.
  const initialParsed =
    parseDateRangeFromText(initialName) ?? parseDateRangeFromText(initialDesc);

  const [name, setName] = useState(initialParsed ? stripTrailingDateText(initialName, initialParsed) : initialName);
  const [startDate, setStartDate] = useState(initialParsed?.startDate ?? "");
  const [endDate, setEndDate] = useState(initialParsed?.endDate ?? "");
  const [city, setCity] = useState("");
  const [link, setLink] = useState(initialLink);
  const [shortDesc, setShortDesc] = useState(initialDesc);
  const [imageUrl, setImageUrl] = useState(initialImage);
  const [status, setStatus] = useState("");
  const [datesGuessed, setDatesGuessed] = useState(Boolean(initialParsed));
  const [saving, setSaving] = useState(false);

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
        body: JSON.stringify({ name, startDate, endDate, city, link, shortDesc, imageUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data.message || "Failed to save.");
      } else {
        showToast("Saved!");
        onSaved(data.slug ?? "");
      }
    } catch {
      setStatus("Failed to save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-[color:var(--muted)]">Event name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          className="h-10 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--pill)] px-3 text-sm outline-none"
        />
      </label>

      <div className="grid grid-cols-2 gap-2.5">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[color:var(--muted)]">Start date</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setDatesGuessed(false);
            }}
            className="h-10 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--pill)] px-2.5 text-sm outline-none"
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
            className="h-10 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--pill)] px-2.5 text-sm outline-none"
          />
        </label>
      </div>
      {datesGuessed && (
        <p className="-mt-1.5 text-xs text-[color:var(--theme-gold)]">Guessed from the title — double-check before saving.</p>
      )}

      {imageUrl && (
        <div className="flex items-center gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--pill)] p-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- unknown external domain, preview only */}
          <img src={imageUrl} alt="" className="h-12 w-16 rounded object-cover" />
          <div className="min-w-0 flex-1 text-xs text-[color:var(--muted)]">Pulled from the page automatically.</div>
          <button type="button" onClick={() => setImageUrl("")} className="shrink-0 text-xs font-semibold text-[color:var(--muted)] underline">
            Remove
          </button>
        </div>
      )}

      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-[color:var(--muted)]">City / State (optional)</span>
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="h-10 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--pill)] px-3 text-sm outline-none"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-[color:var(--muted)]">Link (optional)</span>
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          className="h-10 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--pill)] px-3 text-sm outline-none"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-[color:var(--muted)]">Description (optional)</span>
        <textarea
          value={shortDesc}
          onChange={(e) => setShortDesc(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--pill)] px-3 py-2 text-sm outline-none"
        />
      </label>

      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className="vltd-primary-button h-10 w-full rounded-lg text-sm font-black disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save event"}
      </button>

      {status && <div className="text-sm text-[color:var(--muted)]">{status}</div>}
    </div>
  );
}
