"use client";

import { useEffect, useState } from "react";
import {
  fetchAllThemes,
  upsertTheme,
  deleteTheme,
  type SeasonalTheme,
  type AccentStyle,
} from "@/lib/seasonalTheme";
import { showToast } from "@/lib/toast";
import { useSaveFeedback } from "@/lib/useSaveFeedback";

const ACCENT_STYLES: AccentStyle[] = ["none", "snowflakes", "confetti", "stars", "leaves"];
const ACCENT_STYLE_LABELS: Record<AccentStyle, string> = {
  none: "None",
  snowflakes: "❄️ Snowflakes",
  confetti: "🎊 Confetti",
  stars: "✦ Stars",
  leaves: "🍂 Leaves",
};

const EMPTY: Partial<SeasonalTheme> = {
  name: "",
  slug: "",
  starts_at: "",
  ends_at: "",
  enabled: true,
  accent_color: "#E8B84B",
  accent_secondary: "#1a1a2e",
  bg_tint: "",
  banner_enabled: true,
  banner_heading: "",
  banner_subtext: "",
  banner_emoji: "",
  banner_cta_label: "",
  banner_cta_href: "",
  featured_category: "",
  accent_style: "none",
};

function toLocalDatetimeValue(iso: string) {
  if (!iso) return "";
  return iso.slice(0, 16);
}

function toIso(local: string) {
  if (!local) return "";
  return new Date(local).toISOString();
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function isActive(t: SeasonalTheme) {
  const now = Date.now();
  return t.enabled && new Date(t.starts_at).getTime() <= now && new Date(t.ends_at).getTime() >= now;
}

function isUpcoming(t: SeasonalTheme) {
  return t.enabled && new Date(t.starts_at).getTime() > Date.now();
}

export default function AdminThemesPage() {
  const [themes, setThemes] = useState<SeasonalTheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<SeasonalTheme> | null>(null);
  const [saving, setSaving] = useState(false);
  const { justSaved, flashSaved } = useSaveFeedback();
  const [deleting, setDeleting] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setThemes(await fetchAllThemes());
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  function openNew() {
    setEditing({ ...EMPTY });
  }

  function openEdit(t: SeasonalTheme) {
    setEditing({
      ...t,
      starts_at: toLocalDatetimeValue(t.starts_at),
      ends_at: toLocalDatetimeValue(t.ends_at),
    });
  }

  function set<K extends keyof SeasonalTheme>(key: K, value: SeasonalTheme[K]) {
    setEditing((prev) => {
      if (!prev) return prev;
      const next = { ...prev, [key]: value };
      if (key === "name" && !prev.id) {
        next.slug = slugify(value as string);
      }
      return next;
    });
  }

  async function save() {
    if (!editing?.slug || !editing.name || !editing.starts_at || !editing.ends_at) {
      showToast("Name, slug, start and end date are required.");
      return;
    }
    setSaving(true);
    const payload = {
      ...editing,
      starts_at: toIso(editing.starts_at as string),
      ends_at: toIso(editing.ends_at as string),
    } as Partial<SeasonalTheme> & { slug: string };

    const { error } = await upsertTheme(payload);
    setSaving(false);
    if (error) { showToast(`Error: ${error}`); return; }
    showToast("Theme saved.");
    flashSaved();
    // Hold the editor open briefly so the green "Saved" state on the button is visible
    // before the panel closes — otherwise the success flash would never be seen.
    setTimeout(() => {
      setEditing(null);
      void load();
    }, 550);
  }

  async function remove(id: string) {
    if (!confirm("Delete this theme?")) return;
    setDeleting(id);
    const { error } = await deleteTheme(id);
    setDeleting(null);
    if (error) { showToast(`Error: ${error}`); return; }
    showToast("Deleted.");
    void load();
  }

  // Group by status
  const active   = themes.filter(isActive);
  const upcoming = themes.filter(isUpcoming);
  const past     = themes.filter((t) => !isActive(t) && !isUpcoming(t));

  return (
    <div className="min-h-screen bg-[#08080E] text-white px-4 py-8 max-w-4xl mx-auto">
      <a href="/admin/characters" className="inline-flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition mb-6">
        ← Admin Home
      </a>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Seasonal Themes</h1>
          <p className="text-sm text-white/40 mt-1">
            Schedule app-wide themes for events, holidays, and moments.
            They activate and expire automatically.
          </p>
        </div>
        <button
          onClick={openNew}
          className="rounded-full bg-amber-500 px-4 py-2 text-sm font-bold text-black hover:bg-amber-400 transition"
        >
          + New Theme
        </button>
      </div>

      {loading ? (
        <p className="text-white/40 text-sm">Loading…</p>
      ) : (
        <div className="space-y-8">
          <ThemeGroup label="🟢 Active Now" themes={active} onEdit={openEdit} onDelete={remove} deleting={deleting} />
          <ThemeGroup label="🕐 Upcoming" themes={upcoming} onEdit={openEdit} onDelete={remove} deleting={deleting} />
          <ThemeGroup label="⬜ Past" themes={past} onEdit={openEdit} onDelete={remove} deleting={deleting} />
          {themes.length === 0 && (
            <p className="text-white/30 text-sm text-center py-12">No themes yet — create your first one.</p>
          )}
        </div>
      )}

      {/* Edit drawer */}
      {editing && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setEditing(null)} />
          <div className="relative ml-auto h-full w-full max-w-lg overflow-y-auto bg-[#0E0C1A] border-l border-white/10 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold">{editing.id ? "Edit Theme" : "New Theme"}</h2>
              <button onClick={() => setEditing(null)} className="text-white/40 hover:text-white text-xl">✕</button>
            </div>

            <div className="space-y-5">
              {/* Name + slug */}
              <Field label="Event Name *">
                <input
                  value={editing.name ?? ""}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="FIFA World Cup 2026"
                  className="vltd-input w-full"
                />
              </Field>
              <Field label="Slug (auto-generated, must be unique)">
                <input
                  value={editing.slug ?? ""}
                  onChange={(e) => set("slug", e.target.value)}
                  placeholder="fifa-2026"
                  className="vltd-input w-full font-mono text-sm"
                />
              </Field>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start Date *">
                  <input
                    type="datetime-local"
                    value={editing.starts_at ?? ""}
                    onChange={(e) => set("starts_at", e.target.value)}
                    className="vltd-input w-full text-sm"
                  />
                </Field>
                <Field label="End Date *">
                  <input
                    type="datetime-local"
                    value={editing.ends_at ?? ""}
                    onChange={(e) => set("ends_at", e.target.value)}
                    className="vltd-input w-full text-sm"
                  />
                </Field>
              </div>

              <Toggle
                label="Enabled"
                value={editing.enabled ?? true}
                onChange={(v) => set("enabled", v)}
              />

              {/* Colors */}
              <div className="border-t border-white/10 pt-4">
                <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Colors</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Accent Color">
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={editing.accent_color ?? "#E8B84B"}
                        onChange={(e) => set("accent_color", e.target.value)}
                        className="h-9 w-12 rounded cursor-pointer bg-transparent border border-white/20"
                      />
                      <input
                        value={editing.accent_color ?? ""}
                        onChange={(e) => set("accent_color", e.target.value)}
                        className="vltd-input flex-1 font-mono text-sm"
                        placeholder="#E8B84B"
                      />
                    </div>
                  </Field>
                  <Field label="Secondary Color">
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={editing.accent_secondary ?? "#1a1a2e"}
                        onChange={(e) => set("accent_secondary", e.target.value)}
                        className="h-9 w-12 rounded cursor-pointer bg-transparent border border-white/20"
                      />
                      <input
                        value={editing.accent_secondary ?? ""}
                        onChange={(e) => set("accent_secondary", e.target.value)}
                        className="vltd-input flex-1 font-mono text-sm"
                        placeholder="#1a1a2e"
                      />
                    </div>
                  </Field>
                </div>
              </div>

              {/* Accent particles */}
              <Field label="Accent Style">
                <select
                  value={editing.accent_style ?? "none"}
                  onChange={(e) => set("accent_style", e.target.value as AccentStyle)}
                  className="vltd-input w-full"
                >
                  {ACCENT_STYLES.map((s) => (
                    <option key={s} value={s}>{ACCENT_STYLE_LABELS[s]}</option>
                  ))}
                </select>
              </Field>

              {/* Banner */}
              <div className="border-t border-white/10 pt-4">
                <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Home Banner</p>
                <Toggle
                  label="Show Banner"
                  value={editing.banner_enabled ?? false}
                  onChange={(v) => set("banner_enabled", v)}
                />
                {editing.banner_enabled && (
                  <div className="mt-3 space-y-3">
                    <div className="grid grid-cols-4 gap-2">
                      <Field label="Emoji">
                        <input
                          value={editing.banner_emoji ?? ""}
                          onChange={(e) => set("banner_emoji", e.target.value)}
                          placeholder="⚽"
                          className="vltd-input w-full text-center text-lg"
                        />
                      </Field>
                      <div className="col-span-3">
                        <Field label="Heading">
                          <input
                            value={editing.banner_heading ?? ""}
                            onChange={(e) => set("banner_heading", e.target.value)}
                            placeholder="FIFA World Cup is here!"
                            className="vltd-input w-full"
                          />
                        </Field>
                      </div>
                    </div>
                    <Field label="Subtext">
                      <input
                        value={editing.banner_subtext ?? ""}
                        onChange={(e) => set("banner_subtext", e.target.value)}
                        placeholder="Discover soccer card collections"
                        className="vltd-input w-full"
                      />
                    </Field>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="CTA Label">
                        <input
                          value={editing.banner_cta_label ?? ""}
                          onChange={(e) => set("banner_cta_label", e.target.value)}
                          placeholder="Explore Soccer Vaults"
                          className="vltd-input w-full"
                        />
                      </Field>
                      <Field label="CTA Link">
                        <input
                          value={editing.banner_cta_href ?? ""}
                          onChange={(e) => set("banner_cta_href", e.target.value)}
                          placeholder="/discover?category=Soccer"
                          className="vltd-input w-full"
                        />
                      </Field>
                    </div>
                  </div>
                )}
              </div>

              {/* Featured category */}
              <div className="border-t border-white/10 pt-4">
                <Field label="Featured Category (pinned top of Discover)">
                  <input
                    value={editing.featured_category ?? ""}
                    onChange={(e) => set("featured_category", e.target.value)}
                    placeholder="Soccer"
                    className="vltd-input w-full"
                  />
                </Field>
              </div>

              {/* Live preview */}
              {editing.banner_enabled && editing.banner_heading && (
                <div className="border-t border-white/10 pt-4">
                  <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Preview</p>
                  <div
                    className="relative overflow-hidden rounded-xl px-4 py-3"
                    style={{
                      background: `linear-gradient(135deg, ${editing.accent_secondary ?? "#1a1a2e"}cc, ${editing.accent_color ?? "#E8B84B"}33)`,
                      border: `1px solid ${editing.accent_color ?? "#E8B84B"}44`,
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {editing.banner_emoji && <span className="text-2xl">{editing.banner_emoji}</span>}
                        <div>
                          <p className="text-sm font-bold text-white">{editing.banner_heading}</p>
                          {editing.banner_subtext && (
                            <p className="text-xs mt-0.5" style={{ color: `${editing.accent_color}cc` }}>
                              {editing.banner_subtext}
                            </p>
                          )}
                        </div>
                      </div>
                      {editing.banner_cta_label && (
                        <span
                          className="rounded-full px-3 py-1 text-xs font-bold"
                          style={{ background: editing.accent_color ?? "#E8B84B", color: "#000" }}
                        >
                          {editing.banner_cta_label}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-8 flex gap-3">
              <button
                onClick={() => void save()}
                disabled={saving}
                className={[
                  "flex-1 rounded-full py-2.5 text-sm font-bold transition disabled:opacity-50",
                  justSaved ? "bg-emerald-500 text-white" : "bg-amber-500 text-black hover:bg-amber-400",
                ].join(" ")}
              >
                {saving ? "Saving…" : justSaved ? "Saved ✓" : "Save Theme"}
              </button>
              <button
                onClick={() => setEditing(null)}
                className="rounded-full border border-white/20 px-5 py-2.5 text-sm text-white/60 hover:text-white transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ThemeGroup({
  label,
  themes,
  onEdit,
  onDelete,
  deleting,
}: {
  label: string;
  themes: SeasonalTheme[];
  onEdit: (t: SeasonalTheme) => void;
  onDelete: (id: string) => void;
  deleting: string | null;
}) {
  if (themes.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">{label}</p>
      <div className="space-y-2">
        {themes.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3"
          >
            {/* Color swatch */}
            <div
              className="h-9 w-9 rounded-lg flex-shrink-0"
              style={{ background: `linear-gradient(135deg, ${t.accent_secondary ?? "#222"}, ${t.accent_color ?? "#E8B84B"})` }}
            />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-white truncate">
                {t.banner_emoji} {t.name}
              </p>
              <p className="text-xs text-white/40 mt-0.5">
                {new Date(t.starts_at).toLocaleDateString()} → {new Date(t.ends_at).toLocaleDateString()}
                {t.featured_category ? ` · 📌 ${t.featured_category}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {!t.enabled && (
                <span className="text-xs text-white/30 border border-white/10 rounded-full px-2 py-0.5">Off</span>
              )}
              <button
                onClick={() => onEdit(t)}
                className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/60 hover:text-white transition"
              >
                Edit
              </button>
              <button
                onClick={() => onDelete(t.id)}
                disabled={deleting === t.id}
                className="rounded-full border border-red-500/30 px-3 py-1 text-xs text-red-400 hover:text-red-300 transition disabled:opacity-40"
              >
                {deleting === t.id ? "…" : "Delete"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-white/50 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex items-center gap-3 text-sm text-white/70 hover:text-white transition"
    >
      <span
        className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${value ? "bg-amber-500" : "bg-white/20"}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${value ? "translate-x-4" : "translate-x-0.5"}`}
        />
      </span>
      {label}
    </button>
  );
}
