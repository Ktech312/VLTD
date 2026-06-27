"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { getMyAdminRole } from "@/lib/adminAuth";

type Spotlight = {
  id: string;
  type: "collector" | "artist" | "brand";
  name: string;
  tagline: string;
  bio: string;
  image_url: string;
  universe_tags: string[];
  link_url: string;
  link_label: string;
  is_featured: boolean;
  sort_order: number;
  enabled: boolean;
};

const EMPTY_FORM: Omit<Spotlight, "id"> = {
  type: "collector",
  name: "",
  tagline: "",
  bio: "",
  image_url: "",
  universe_tags: [],
  link_url: "",
  link_label: "",
  is_featured: false,
  sort_order: 0,
  enabled: true,
};

function inputCls() {
  return "w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--fg)] outline-none focus:border-[rgba(245,181,72,0.5)] focus:ring-2 focus:ring-[rgba(245,181,72,0.12)]";
}

export default function AdminSpotlightsPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [spotlights, setSpotlights] = useState<Spotlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Omit<Spotlight, "id">>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  useEffect(() => {
    getMyAdminRole().then((role) => setAuthorized(role !== null));
  }, []);

  async function fetchAll() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const { data } = await supabase
      .from("spotlights")
      .select("*")
      .order("sort_order", { ascending: true });
    setSpotlights((data ?? []) as Spotlight[]);
    setLoading(false);
  }

  useEffect(() => {
    if (authorized) void fetchAll();
  }, [authorized]);

  function startEdit(s: Spotlight) {
    setEditingId(s.id);
    setForm({
      type: s.type,
      name: s.name,
      tagline: s.tagline ?? "",
      bio: s.bio ?? "",
      image_url: s.image_url ?? "",
      universe_tags: s.universe_tags ?? [],
      link_url: s.link_url ?? "",
      link_label: s.link_label ?? "",
      is_featured: s.is_featured,
      sort_order: s.sort_order,
      enabled: s.enabled,
    });
    setShowForm(true);
  }

  function startNew() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  async function handleSave() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !form.name.trim()) return;
    setSaving(true);
    setStatusMsg("");
    const payload = {
      ...form,
      universe_tags: form.universe_tags,
      updated_at: new Date().toISOString(),
    };
    let err;
    if (editingId) {
      ({ error: err } = await supabase.from("spotlights").update(payload).eq("id", editingId));
    } else {
      ({ error: err } = await supabase.from("spotlights").insert(payload));
    }
    setSaving(false);
    if (err) { setStatusMsg("Error: " + err.message); return; }
    setStatusMsg(editingId ? "Updated." : "Created.");
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    void fetchAll();
    setTimeout(() => setStatusMsg(""), 3000);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this spotlight?")) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    await supabase.from("spotlights").delete().eq("id", id);
    void fetchAll();
  }

  if (authorized === null) {
    return <div className="p-8 text-sm text-[color:var(--muted)]">Checking access…</div>;
  }
  if (!authorized) {
    return <div className="p-8 text-sm text-red-400">Not authorized. Admin access required.</div>;
  }

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6" style={{ background: "var(--bg)" }}>
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.28em]" style={{ color: "var(--muted2)" }}>Admin</div>
            <h1 className="mt-1 text-2xl font-black" style={{ color: "var(--fg)" }}>Spotlights</h1>
          </div>
          <button
            type="button"
            onClick={startNew}
            className="rounded-full px-5 py-2.5 text-sm font-black text-[#0B0B0B] transition hover:brightness-110"
            style={{ background: "linear-gradient(135deg, #8B6914, #F5B548)" }}
          >
            + Add Spotlight
          </button>
        </div>

        {statusMsg && (
          <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
            {statusMsg}
          </div>
        )}

        {/* Inline form */}
        {showForm && (
          <div
            className="mb-6 rounded-[24px] p-5"
            style={{ background: "var(--theme-elevated)", border: "1px solid rgba(245,181,72,0.25)" }}
          >
            <h2 className="mb-4 text-base font-black" style={{ color: "var(--fg)" }}>
              {editingId ? "Edit Spotlight" : "New Spotlight"}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Type */}
              <label className="block">
                <span className="mb-1 block text-xs font-semibold" style={{ color: "var(--muted)" }}>Type</span>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as Spotlight["type"] }))}
                  className={inputCls()}
                >
                  <option value="collector">Collector</option>
                  <option value="artist">Artist</option>
                  <option value="brand">Brand</option>
                </select>
              </label>

              {/* Name */}
              <label className="block">
                <span className="mb-1 block text-xs font-semibold" style={{ color: "var(--muted)" }}>Name *</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Display name"
                  className={inputCls()}
                />
              </label>

              {/* Tagline */}
              <label className="block">
                <span className="mb-1 block text-xs font-semibold" style={{ color: "var(--muted)" }}>Tagline</span>
                <input
                  value={form.tagline}
                  onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
                  placeholder="Short one-liner"
                  className={inputCls()}
                />
              </label>

              {/* Image URL */}
              <label className="block">
                <span className="mb-1 block text-xs font-semibold" style={{ color: "var(--muted)" }}>Image URL</span>
                <input
                  value={form.image_url}
                  onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
                  placeholder="https://..."
                  className={inputCls()}
                />
              </label>

              {/* Bio */}
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs font-semibold" style={{ color: "var(--muted)" }}>Bio</span>
                <textarea
                  value={form.bio}
                  onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                  placeholder="About this person or brand…"
                  rows={3}
                  className={inputCls() + " resize-none"}
                />
              </label>

              {/* Universe tags */}
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs font-semibold" style={{ color: "var(--muted)" }}>Universe tags <span className="font-normal">(comma-separated)</span></span>
                <input
                  value={(form.universe_tags ?? []).join(", ")}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      universe_tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
                    }))
                  }
                  placeholder="Sports, TCG, Pop Culture"
                  className={inputCls()}
                />
              </label>

              {/* Link URL */}
              <label className="block">
                <span className="mb-1 block text-xs font-semibold" style={{ color: "var(--muted)" }}>Link URL</span>
                <input
                  value={form.link_url}
                  onChange={(e) => setForm((f) => ({ ...f, link_url: e.target.value }))}
                  placeholder="https://..."
                  className={inputCls()}
                />
              </label>

              {/* Link label */}
              <label className="block">
                <span className="mb-1 block text-xs font-semibold" style={{ color: "var(--muted)" }}>Link label</span>
                <input
                  value={form.link_label}
                  onChange={(e) => setForm((f) => ({ ...f, link_label: e.target.value }))}
                  placeholder="Visit profile →"
                  className={inputCls()}
                />
              </label>

              {/* Sort order */}
              <label className="block">
                <span className="mb-1 block text-xs font-semibold" style={{ color: "var(--muted)" }}>Sort order</span>
                <input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))}
                  className={inputCls()}
                />
              </label>

              {/* Toggles */}
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_featured}
                    onChange={(e) => setForm((f) => ({ ...f, is_featured: e.target.checked }))}
                    className="h-4 w-4 accent-amber-500"
                  />
                  <span className="text-sm font-semibold" style={{ color: "var(--fg)" }}>Featured</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.enabled}
                    onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                    className="h-4 w-4 accent-amber-500"
                  />
                  <span className="text-sm font-semibold" style={{ color: "var(--fg)" }}>Enabled</span>
                </label>
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving || !form.name.trim()}
                className="rounded-full px-6 py-2.5 text-sm font-black text-[#0B0B0B] transition hover:brightness-110 disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #8B6914, #F5B548)" }}
              >
                {saving ? "Saving…" : editingId ? "Update" : "Create"}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); }}
                className="rounded-full border px-6 py-2.5 text-sm font-semibold transition hover:brightness-110"
                style={{ borderColor: "var(--border)", color: "var(--muted)" }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Spotlight list */}
        {loading ? (
          <div className="text-sm" style={{ color: "var(--muted)" }}>Loading…</div>
        ) : spotlights.length === 0 ? (
          <div className="rounded-[24px] py-12 text-center text-sm" style={{ background: "var(--theme-card)", color: "var(--muted)", border: "1px solid var(--border)" }}>
            No spotlights yet. Click "Add Spotlight" to create the first one.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {spotlights.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-4 rounded-[20px] px-4 py-3"
                style={{ background: "var(--theme-card)", border: s.is_featured ? "1px solid rgba(245,181,72,0.35)" : "1px solid var(--border)" }}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl text-xl"
                  style={{ background: "var(--theme-elevated)" }}>
                  {s.image_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={s.image_url} alt="" className="h-full w-full object-cover" />
                    : s.type === "artist" ? "🧑‍🎨" : s.type === "brand" ? "🏢" : "🗝️"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold truncate" style={{ color: "var(--fg)" }}>{s.name}</span>
                    {s.is_featured && <span className="text-[10px] font-bold text-amber-400">★ Featured</span>}
                    {!s.enabled && <span className="text-[10px] text-red-400">disabled</span>}
                  </div>
                  <div className="text-xs truncate" style={{ color: "var(--muted)" }}>
                    {s.type} {s.tagline ? `· ${s.tagline}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => startEdit(s)}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold transition hover:brightness-110"
                    style={{ background: "var(--theme-elevated)", color: "var(--fg)", border: "1px solid var(--border)" }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(s.id)}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold transition hover:bg-red-500/15"
                    style={{ color: "#E05252", border: "1px solid rgba(224,82,82,0.25)" }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
