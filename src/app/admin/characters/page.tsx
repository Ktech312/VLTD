"use client";

// ─────────────────────────────────────────────────────────────
// /admin/characters — Seed Character Admin
// ─────────────────────────────────────────────────────────────

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { VAULT_IMAGES_BUCKET } from "@/lib/vaultCloud";
import { SEED_CHARACTERS } from "@/lib/seedCharacters";
import { SEED_CHARACTERS_PART2 } from "@/lib/seedCharacters_part2";
import { SEED_CHARACTERS_PART3 } from "@/lib/seedCharacters_part3";
import { SEED_CHARACTERS_PART4 } from "@/lib/seedCharacters_part4";
import type { SeedCharacter, SeedItem, SeedGallery } from "@/lib/seedCharacters";

const ALL_CHARACTERS: SeedCharacter[] = [
  ...SEED_CHARACTERS,
  ...SEED_CHARACTERS_PART2,
  ...SEED_CHARACTERS_PART3,
  ...SEED_CHARACTERS_PART4,
];

const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY ?? "vltd-admin-2024";

// ── Live item data from Supabase ───────────────────────────────
type LiveItem = { imageUrl: string; disabled: boolean };

// ── Formatters ──────────────────────────────────────────────
function formatMoney(n?: number) {
  if (!n) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

// ── Auth Gate ───────────────────────────────────────────────
function AuthGate({ onUnlock }: { onUnlock: () => void }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  function attempt() {
    if (input === ADMIN_KEY) {
      onUnlock();
    } else {
      setError(true);
      setInput("");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0c12]">
      <div className="w-full max-w-sm rounded-[24px] bg-[#111318] p-8 ring-1 ring-white/10">
        <div className="text-center">
          <div className="text-2xl">🔐</div>
          <div className="mt-2 text-sm font-semibold text-white">Admin Access</div>
          <div className="mt-1 text-xs text-white/40">Character Management</div>
        </div>
        <input
          type="password"
          value={input}
          onChange={(e) => { setInput(e.target.value); setError(false); }}
          onKeyDown={(e) => e.key === "Enter" && attempt()}
          placeholder="Admin key"
          className="mt-6 w-full rounded-xl bg-white/5 px-4 py-2.5 text-sm text-white ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-amber-400/40 placeholder:text-white/30"
        />
        {error && <div className="mt-2 text-center text-xs text-red-400">Incorrect key</div>}
        <button
          onClick={attempt}
          className="mt-4 w-full rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-black transition hover:bg-amber-400"
        >
          Enter
        </button>
      </div>
    </div>
  );
}

// ── Item Edit Modal ───────────────────────────────────────────
function ItemEditModal({
  item,
  live,
  onSave,
  onClose,
}: {
  item: SeedItem;
  live?: LiveItem;
  onSave: (id: string, data: Partial<LiveItem & { title: string; subtitle: string; notes: string; grade: string; currentValue: number; purchasePrice: number }>) => Promise<void>;
  onClose: () => void;
}) {
  const [imageUrl, setImageUrl] = useState(live?.imageUrl ?? "");
  const [title, setTitle] = useState(item.title ?? "");
  const [subtitle, setSubtitle] = useState(item.subtitle ?? "");
  const [notes, setNotes] = useState(item.notes ?? "");
  const [grade, setGrade] = useState(item.grade ?? "");
  const [value, setValue] = useState(String(item.currentValue ?? ""));
  const [cost, setCost] = useState(String(item.purchasePrice ?? ""));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setError("No Supabase client"); return; }
    setUploading(true);
    setError("");
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `admin/${item.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(VAULT_IMAGES_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw new Error(upErr.message);
      const { data: { publicUrl } } = supabase.storage
        .from(VAULT_IMAGES_BUCKET)
        .getPublicUrl(path);
      setImageUrl(publicUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      await onSave(item.id, {
        imageUrl: imageUrl.trim(),
        title: title.trim(),
        subtitle: subtitle.trim(),
        notes: notes.trim(),
        grade: grade.trim(),
        currentValue: Number(value) || 0,
        purchasePrice: Number(cost) || 0,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-[24px] bg-[#14181f] ring-1 ring-white/10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <div className="text-sm font-semibold text-white">Edit Item</div>
          <button onClick={onClose} className="text-white/40 hover:text-white text-lg leading-none">✕</button>
        </div>

        {/* Image preview + URL + Upload */}
        <div className="px-5 pt-4">
          <div className="flex gap-3">
            {/* Thumbnail — click to upload */}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="relative h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/10 group hover:ring-amber-400/40 transition"
              title="Click to upload image"
            >
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-1">
                  <span className="text-lg opacity-30">📷</span>
                  <span className="text-[8px] text-white/25">Upload</span>
                </div>
              )}
              {/* Hover overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition rounded-xl">
                <span className="text-[9px] font-semibold text-white">
                  {uploading ? "Uploading…" : "Replace"}
                </span>
              </div>
            </button>

            {/* URL field + upload button */}
            <div className="flex-1 flex flex-col gap-2">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-white/30">Image URL</label>
                <input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="Paste URL or upload a file →"
                  className="mt-1 w-full rounded-xl bg-white/5 px-3 py-2 text-xs text-white ring-1 ring-white/10 focus:outline-none focus:ring-amber-400/40 placeholder:text-white/20"
                />
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-white/60 hover:bg-white/10 hover:text-white transition disabled:opacity-40"
              >
                {uploading ? "Uploading…" : "📁 Upload from computer"}
              </button>
            </div>
          </div>
          {/* Hidden file input */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleUpload(file);
              e.target.value = "";
            }}
          />
        </div>

        {/* Fields */}
        <div className="grid grid-cols-2 gap-3 px-5 pt-4">
          {[
            { label: "Title", value: title, set: setTitle, full: true },
            { label: "Subtitle", value: subtitle, set: setSubtitle, full: true },
            { label: "Grade", value: grade, set: setGrade },
            { label: "Notes", value: notes, set: setNotes, full: true, area: true },
            { label: "Est. Value ($)", value: value, set: setValue },
            { label: "Purchase Cost ($)", value: cost, set: setCost },
          ].map(({ label, value: v, set, full, area }) => (
            <div key={label} className={full ? "col-span-2" : ""}>
              <label className="text-[10px] uppercase tracking-widest text-white/30">{label}</label>
              {area ? (
                <textarea
                  value={v}
                  onChange={(e) => set(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-xl bg-white/5 px-3 py-2 text-xs text-white ring-1 ring-white/10 focus:outline-none focus:ring-amber-400/40 resize-none placeholder:text-white/25"
                />
              ) : (
                <input
                  value={v}
                  onChange={(e) => set(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-white/5 px-3 py-2 text-xs text-white ring-1 ring-white/10 focus:outline-none focus:ring-amber-400/40 placeholder:text-white/25"
                />
              )}
            </div>
          ))}
        </div>

        {error && <div className="mx-5 mt-2 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</div>}

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-white/8 px-5 py-4">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-xs text-white/50 hover:text-white transition">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-amber-500 px-5 py-2 text-xs font-semibold text-black transition hover:bg-amber-400 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Bio Edit Modal ────────────────────────────────────────────
function BioEditModal({
  char,
  currentBio,
  onSave,
  onClose,
}: {
  char: SeedCharacter;
  currentBio: string;
  onSave: (bio: string) => Promise<void>;
  onClose: () => void;
}) {
  const [bio, setBio] = useState(currentBio);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      await onSave(bio.trim());
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-lg rounded-[24px] bg-[#14181f] ring-1 ring-white/10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">{char.avatarEmoji}</span>
            <div className="text-sm font-semibold text-white">Edit Bio — {char.displayName}</div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white text-lg leading-none">✕</button>
        </div>
        <div className="p-5">
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={8}
            className="w-full rounded-xl bg-white/5 px-4 py-3 text-sm text-white ring-1 ring-white/10 focus:outline-none focus:ring-amber-400/40 leading-relaxed resize-none"
          />
          <div className="mt-1 text-right text-[10px] text-white/25">{bio.length} chars</div>
        </div>
        {error && <div className="mx-5 mb-3 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</div>}
        <div className="flex justify-end gap-2 border-t border-white/8 px-5 py-4">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-xs text-white/50 hover:text-white transition">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-amber-500 px-5 py-2 text-xs font-semibold text-black transition hover:bg-amber-400 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Bio"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Exhibit Edit Modal ────────────────────────────────────────
function ExhibitEditModal({
  exhibit,
  profileId,
  onSave,
  onClose,
}: {
  exhibit: SeedGallery;
  profileId: string;
  onSave: (id: string, data: { title: string; description: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(exhibit.title);
  const [description, setDescription] = useState(exhibit.description);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      await onSave(exhibit.id, { title: title.trim(), description: description.trim() });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-lg rounded-[24px] bg-[#14181f] ring-1 ring-white/10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <div className="text-sm font-semibold text-white">Edit Exhibit</div>
          <button onClick={onClose} className="text-white/40 hover:text-white text-lg leading-none">✕</button>
        </div>
        <div className="grid gap-3 p-5">
          <div>
            <label className="text-[10px] uppercase tracking-widest text-white/30">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-xl bg-white/5 px-3 py-2 text-sm text-white ring-1 ring-white/10 focus:outline-none focus:ring-amber-400/40"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-white/30">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-xl bg-white/5 px-3 py-2 text-sm text-white ring-1 ring-white/10 focus:outline-none focus:ring-amber-400/40 resize-none leading-relaxed"
            />
          </div>
          <div className="rounded-xl bg-white/[0.03] px-3 py-2 text-[10px] text-white/30">
            <span className="text-white/20">ID: </span><span className="font-mono">{exhibit.id}</span>
            <span className="ml-4 text-white/20">Items: </span>{exhibit.itemIds.length}
          </div>
        </div>
        {error && <div className="mx-5 mb-3 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</div>}
        <div className="flex justify-end gap-2 border-t border-white/8 px-5 py-4">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-xs text-white/50 hover:text-white transition">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-amber-500 px-5 py-2 text-xs font-semibold text-black transition hover:bg-amber-400 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Exhibit"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Item Row ─────────────────────────────────────────────────
function ItemRow({
  item,
  index,
  live,
  onEdit,
  onToggleDisable,
}: {
  item: SeedItem;
  index: number;
  live?: LiveItem;
  onEdit: (item: SeedItem) => void;
  onToggleDisable: (item: SeedItem) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const imageUrl = live?.imageUrl ?? "";
  const disabled = live?.disabled ?? false;

  return (
    <div className="border-b border-white/5 last:border-0">
      <div className="flex w-full items-center gap-3 px-4 py-2.5">
        {/* Index */}
        <span className="w-5 shrink-0 text-center text-[10px] text-white/25">{index + 1}</span>

        {/* Thumbnail */}
        <div className="h-10 w-8 shrink-0 overflow-hidden rounded-lg bg-white/5 ring-1 ring-white/8">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-[8px] text-white/20">—</div>
          )}
        </div>

        {/* Title */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 min-w-0 text-left"
        >
          <div className={["text-xs font-medium leading-tight", disabled ? "text-white/30 line-through" : "text-white/80"].join(" ")}>
            {item.title}
          </div>
          {item.subtitle && (
            <div className="text-[10px] text-white/30 truncate">{item.subtitle}</div>
          )}
        </button>

        {/* Value */}
        <span className="shrink-0 text-[10px] font-semibold text-amber-400/70 w-14 text-right">
          {formatMoney(item.currentValue)}
        </span>

        {/* Action buttons */}
        <div className="shrink-0 flex items-center gap-1.5">
          {/* Edit */}
          <button
            onClick={() => onEdit(item)}
            className="rounded-full bg-white/8 px-2.5 py-1 text-[10px] font-semibold text-white/60 hover:bg-white/15 hover:text-white transition"
          >
            Edit
          </button>

          {/* Disable / Enable */}
          <button
            onClick={() => onToggleDisable(item)}
            className="rounded-full px-2.5 py-1 text-[10px] font-semibold transition"
            style={
              disabled
                ? {
                    background: "rgba(239,68,68,0.12)",
                    color: "#f87171",
                    boxShadow: "0 0 8px rgba(239,68,68,0.35), 0 0 0 1px rgba(239,68,68,0.3)",
                  }
                : {
                    background: "rgba(34,197,94,0.10)",
                    color: "#4ade80",
                    boxShadow: "0 0 8px rgba(34,197,94,0.30), 0 0 0 1px rgba(34,197,94,0.25)",
                  }
            }
          >
            {disabled ? "Disabled" : "Enabled"}
          </button>

          {/* Expand toggle */}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-white/20 text-[10px] hover:text-white/50 transition px-1"
          >
            {expanded ? "▲" : "▼"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-3 pt-2 bg-white/[0.02] border-t border-white/5">
          <div className="flex gap-4">
            {/* Image preview */}
            <div className="shrink-0">
              <div className="h-28 w-24 overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/10">
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrl} alt={item.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-1">
                    <span className="text-2xl opacity-20">🖼️</span>
                    <span className="text-[9px] text-white/20">No image</span>
                  </div>
                )}
              </div>
              <button
                onClick={() => onEdit(item)}
                className="mt-1.5 w-full rounded-lg bg-amber-500/15 py-1 text-[10px] font-semibold text-amber-400 hover:bg-amber-500/25 transition"
              >
                Change image
              </button>
            </div>

            {/* Metadata */}
            <div className="flex-1 grid gap-1 text-[11px] text-white/60">
              {item.universe && <div><span className="text-white/30">Universe: </span>{item.universe}</div>}
              {item.category && <div><span className="text-white/30">Category: </span>{item.category}</div>}
              {item.grade && <div><span className="text-white/30">Grade: </span>{item.grade}</div>}
              {item.notes && <div><span className="text-white/30">Notes: </span>{item.notes}</div>}
              <div className="flex flex-wrap gap-4 mt-1">
                <div><span className="text-white/30">Value: </span><span className="text-amber-400">{formatMoney(item.currentValue)}</span></div>
                {item.purchasePrice != null && <div><span className="text-white/30">Cost: </span>{formatMoney(item.purchasePrice)}</div>}
              </div>
              <div className="mt-1"><span className="text-white/20">ID: </span><span className="font-mono text-[9px] text-white/20">{item.id}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Character Card (Sidebar) ──────────────────────────────────
function CharacterCard({
  char,
  isSelected,
  onClick,
}: {
  char: SeedCharacter;
  isSelected: boolean;
  onClick: () => void;
}) {
  const totalValue = char.items.reduce((s, i) => s + (i.currentValue ?? 0), 0);
  return (
    <button
      onClick={onClick}
      className={[
        "w-full rounded-2xl p-4 text-left transition ring-1",
        isSelected
          ? "bg-amber-500/10 ring-amber-400/40"
          : "bg-white/[0.03] ring-white/8 hover:bg-white/[0.06]",
      ].join(" ")}
    >
      <div className="flex items-center gap-2">
        <span className="text-2xl">{char.avatarEmoji}</span>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">{char.displayName}</div>
          <div className="text-[10px] text-white/40">@{char.handle}</div>
        </div>
      </div>
      <div className="mt-2 flex gap-3 text-[10px] text-white/50">
        <span>{char.items.length} items</span>
        <span>{char.galleries.length} exhibits</span>
        <span className="text-amber-400/70">{formatMoney(totalValue)}</span>
      </div>
      <div className="mt-1 text-[10px] text-white/30">{char.primaryFocus}</div>
    </button>
  );
}

// ── Character Detail Panel ────────────────────────────────────
function CharacterDetail({ char }: { char: SeedCharacter }) {
  const [tab, setTab] = useState<"bio" | "items" | "exhibits">("bio");
  const [search, setSearch] = useState("");
  const [liveData, setLiveData] = useState<Map<string, LiveItem>>(new Map());
  const [bio, setBio] = useState(char.bio);
  const [loadingLive, setLoadingLive] = useState(false);

  // Exhibit item management
  const [openExhibitId, setOpenExhibitId] = useState<string | null>(null);
  // Map of galleryId → Set of itemIds currently in that exhibit (loaded from Supabase)
  const [exhibitItemIds, setExhibitItemIds] = useState<Map<string, Set<string>>>(new Map());
  const [savingExhibit, setSavingExhibit] = useState<string | null>(null);

  // Modals
  const [editingItem, setEditingItem] = useState<SeedItem | null>(null);
  const [editingBio, setEditingBio] = useState(false);
  const [editingExhibit, setEditingExhibit] = useState<SeedGallery | null>(null);

  const totalValue = char.items.reduce((s, i) => s + (i.currentValue ?? 0), 0);
  const universes = [...new Set(char.items.map((i) => i.universe).filter(Boolean))];

  // Load live data from Supabase when character changes
  useEffect(() => {
    setLiveData(new Map());
    setBio(char.bio);

    async function loadLive() {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return;
      setLoadingLive(true);
      try {
        const { data } = await supabase
          .from("vault_items")
          .select("id, image_front_url, is_public")
          .eq("profile_id", char.profileId);
        if (data) {
          const map = new Map<string, LiveItem>();
          for (const row of data) {
            map.set(String(row.id), {
              imageUrl: String(row.image_front_url ?? ""),
              disabled: row.is_public === false,
            });
          }
          setLiveData(map);
        }

        // Also fetch bio from public_profiles
        const { data: profData } = await supabase
          .from("public_profiles")
          .select("bio")
          .eq("profile_id", char.profileId)
          .single();
        if (profData?.bio) setBio(String(profData.bio));
      } finally {
        setLoadingLive(false);
      }
    }

    void loadLive();
  }, [char.profileId, char.bio]);

  // Save item edits to Supabase
  const handleSaveItem = useCallback(async (id: string, data: Partial<LiveItem & { title: string; subtitle: string; notes: string; grade: string; currentValue: number; purchasePrice: number }>) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) throw new Error("No Supabase client");

    const { error } = await supabase
      .from("vault_items")
      .update({
        image_front_url: data.imageUrl,
        title: data.title,
        subtitle: data.subtitle,
        notes: data.notes,
        grade: data.grade,
        current_value: data.currentValue,
        purchase_price: data.purchasePrice,
      })
      .eq("id", id);

    if (error) throw new Error(error.message);

    setLiveData((prev) => {
      const next = new Map(prev);
      const existing = next.get(id) ?? { imageUrl: "", disabled: false };
      next.set(id, { ...existing, imageUrl: data.imageUrl ?? existing.imageUrl });
      return next;
    });
  }, []);

  // Toggle disable/enable in Supabase
  const handleToggleDisable = useCallback(async (item: SeedItem) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const current = liveData.get(item.id);
    const nowDisabled = !(current?.disabled ?? false);

    const { error } = await supabase
      .from("vault_items")
      .update({ is_public: !nowDisabled })
      .eq("id", item.id);

    if (!error) {
      setLiveData((prev) => {
        const next = new Map(prev);
        const existing = next.get(item.id) ?? { imageUrl: "", disabled: false };
        next.set(item.id, { ...existing, disabled: nowDisabled });
        return next;
      });
    }
  }, [liveData]);

  // Save bio to Supabase
  const handleSaveBio = useCallback(async (newBio: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) throw new Error("No Supabase client");

    const { error } = await supabase
      .from("public_profiles")
      .update({ bio: newBio })
      .eq("profile_id", char.profileId);

    if (error) throw new Error(error.message);
    setBio(newBio);
  }, [char.profileId]);

  // Save exhibit title/description to Supabase
  const handleSaveExhibit = useCallback(async (id: string, data: { title: string; description: string }) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) throw new Error("No Supabase client");
    const { error } = await supabase
      .from("galleries")
      .update({ title: data.title, description: data.description })
      .eq("id", id);
    if (error) throw new Error(error.message);
  }, []);

  // Load exhibit items from Supabase (layout.itemIds)
  const loadExhibitItems = useCallback(async (galleryId: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const { data } = await supabase
      .from("galleries")
      .select("layout")
      .eq("id", galleryId)
      .single();
    const ids: string[] = data?.layout?.itemIds ?? [];
    setExhibitItemIds((prev) => new Map(prev).set(galleryId, new Set(ids)));
  }, []);

  // Toggle an item in/out of an exhibit (local state only until Save)
  const toggleExhibitItem = useCallback((galleryId: string, itemId: string) => {
    setExhibitItemIds((prev) => {
      const next = new Map(prev);
      const ids = new Set(next.get(galleryId) ?? []);
      if (ids.has(itemId)) ids.delete(itemId); else ids.add(itemId);
      next.set(galleryId, ids);
      return next;
    });
  }, []);

  // Persist exhibit item changes to Supabase
  const saveExhibitItems = useCallback(async (galleryId: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setSavingExhibit(galleryId);
    try {
      const ids = [...(exhibitItemIds.get(galleryId) ?? [])];
      // Fetch current layout so we don't clobber other fields
      const { data } = await supabase.from("galleries").select("layout").eq("id", galleryId).single();
      const layout = { ...(data?.layout ?? {}), itemIds: ids };
      await supabase.from("galleries").update({ layout }).eq("id", galleryId);
    } finally {
      setSavingExhibit(null);
    }
  }, [exhibitItemIds]);

  const filteredItems = useMemo(() => {
    if (!search.trim()) return char.items;
    const q = search.toLowerCase();
    return char.items.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        (i.subtitle ?? "").toLowerCase().includes(q) ||
        (i.universe ?? "").toLowerCase().includes(q) ||
        (i.category ?? "").toLowerCase().includes(q)
    );
  }, [char.items, search]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-white/8 p-5">
        <div className="flex items-center gap-3">
          <span className="text-4xl">{char.avatarEmoji}</span>
          <div>
            <div className="text-xl font-bold text-white">{char.displayName}</div>
            <div className="text-sm text-white/40">@{char.handle}</div>
          </div>
          {loadingLive && (
            <div className="ml-auto text-[10px] text-white/25 animate-pulse">Loading live data…</div>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-[11px]">
          <div className="rounded-full bg-white/5 px-3 py-1 text-white/60">
            {char.items.length} items
          </div>
          <div className="rounded-full bg-white/5 px-3 py-1 text-white/60">
            {char.galleries.length} exhibits
          </div>
          <div className="rounded-full bg-amber-400/10 px-3 py-1 text-amber-400">
            {formatMoney(totalValue)} total value
          </div>
          <div className="rounded-full bg-white/5 px-3 py-1 text-white/60">
            {char.primaryFocus}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {universes.map((u) => (
            <span key={u} className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/40">
              {u}
            </span>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="shrink-0 flex gap-1 border-b border-white/8 px-4 pt-2">
        {(["bio", "items", "exhibits"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              "px-3 py-2 text-xs font-semibold capitalize transition border-b-2",
              tab === t
                ? "border-amber-400 text-amber-400"
                : "border-transparent text-white/40 hover:text-white/70",
            ].join(" ")}
          >
            {t === "items" ? `Items (${char.items.length})` : t === "exhibits" ? `Exhibits (${char.galleries.length})` : "Bio"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">

        {/* ── Bio Tab ── */}
        {tab === "bio" && (
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] uppercase tracking-widest text-white/30">Biography</div>
              <button
                onClick={() => setEditingBio(true)}
                className="rounded-full bg-amber-500/15 px-3 py-1 text-[11px] font-semibold text-amber-400 hover:bg-amber-500/25 transition"
              >
                Edit Bio
              </button>
            </div>
            <div className="text-sm leading-relaxed text-white/70">{bio || <span className="text-white/25 italic">No bio set</span>}</div>

            <div className="mt-4 rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/8">
              <div className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Profile ID</div>
              <div className="font-mono text-xs text-white/50 break-all">{char.profileId}</div>
            </div>
            <div className="mt-3 rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/8">
              <div className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Exhibit IDs</div>
              {char.galleries.map((g) => (
                <div key={g.id} className="font-mono text-[10px] text-white/40 mb-1">{g.id}</div>
              ))}
            </div>
          </div>
        )}

        {/* ── Items Tab ── */}
        {tab === "items" && (
          <div>
            <div className="sticky top-0 bg-[#111318] p-3 border-b border-white/5 z-10">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search items..."
                className="w-full rounded-xl bg-white/5 px-3 py-2 text-xs text-white ring-1 ring-white/10 focus:outline-none placeholder:text-white/30"
              />
              {search && (
                <div className="mt-1 text-[10px] text-white/30">
                  {filteredItems.length} of {char.items.length} items
                </div>
              )}
            </div>
            <div>
              {filteredItems.map((item, i) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  index={i}
                  live={liveData.get(item.id)}
                  onEdit={setEditingItem}
                  onToggleDisable={handleToggleDisable}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Exhibits Tab ── */}
        {tab === "exhibits" && (
          <div className="p-4 grid gap-4">
            {char.galleries.map((g) => {
              const isOpen = openExhibitId === g.id;
              const liveIds = exhibitItemIds.get(g.id);
              const itemCount = liveIds ? liveIds.size : g.itemIds.length;

              return (
                <div key={g.id} className="rounded-2xl ring-1 ring-white/8 overflow-hidden"
                  style={{ background: isOpen ? "rgba(245,181,72,0.04)" : "rgba(255,255,255,0.03)" }}>

                  {/* Exhibit header */}
                  <div className="flex items-start gap-3 p-4">
                    <button
                      className="flex-1 min-w-0 text-left"
                      onClick={async () => {
                        if (isOpen) {
                          setOpenExhibitId(null);
                        } else {
                          setOpenExhibitId(g.id);
                          if (!exhibitItemIds.has(g.id)) await loadExhibitItems(g.id);
                        }
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">{isOpen ? "▼" : "▶"}</span>
                        <div>
                          <div className="font-semibold text-sm text-white">{g.title}</div>
                          <div className="mt-0.5 text-xs text-white/45 leading-relaxed">{g.description}</div>
                        </div>
                      </div>
                    </button>
                    <div className="shrink-0 flex items-center gap-2">
                      <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] text-white/50">
                        {itemCount} items
                      </span>
                      <button
                        onClick={() => setEditingExhibit(g)}
                        className="rounded-full bg-amber-500/15 px-3 py-1 text-[11px] font-semibold text-amber-400 hover:bg-amber-500/25 transition"
                      >
                        Edit Info
                      </button>
                    </div>
                  </div>

                  {/* Expanded item picker */}
                  {isOpen && (
                    <div className="border-t border-white/8">
                      {/* Search within exhibit picker */}
                      <div className="px-4 pt-3 pb-2">
                        <div className="text-[10px] uppercase tracking-widest text-white/30 mb-2">
                          Click items to add or remove from this exhibit
                        </div>
                      </div>

                      {/* Item grid — all character items, highlighted if in exhibit */}
                      <div className="px-4 pb-2 grid grid-cols-2 gap-2 max-h-[420px] overflow-y-auto">
                        {char.items.map((item) => {
                          const inExhibit = liveIds ? liveIds.has(item.id) : g.itemIds.includes(item.id);
                          const imgUrl = liveData.get(item.id)?.imageUrl ?? "";
                          const isDisabled = liveData.get(item.id)?.disabled ?? false;

                          return (
                            <button
                              key={item.id}
                              onClick={() => toggleExhibitItem(g.id, item.id)}
                              className="flex items-center gap-2 rounded-xl p-2 text-left transition"
                              style={{
                                background: inExhibit ? "rgba(245,181,72,0.12)" : "rgba(255,255,255,0.03)",
                                border: inExhibit ? "1px solid rgba(245,181,72,0.35)" : "1px solid rgba(255,255,255,0.06)",
                              }}
                            >
                              {/* Thumbnail */}
                              <div className="h-10 w-8 shrink-0 overflow-hidden rounded-lg bg-white/5">
                                {imgUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={imgUrl} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  <div className="flex h-full items-center justify-center text-[7px] text-white/20">—</div>
                                )}
                              </div>
                              {/* Info */}
                              <div className="min-w-0 flex-1">
                                <div className={["text-[10px] font-medium leading-tight truncate", isDisabled ? "line-through text-white/25" : inExhibit ? "text-amber-300" : "text-white/70"].join(" ")}>
                                  {item.title}
                                </div>
                                <div className="text-[9px] text-white/30 truncate">{item.universe}</div>
                              </div>
                              {/* In/out indicator */}
                              <div className="shrink-0 text-[10px]">
                                {inExhibit ? "✓" : "+"}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Save bar */}
                      <div className="flex items-center justify-between gap-3 border-t border-white/8 px-4 py-3">
                        <div className="text-[10px] text-white/30">
                          {liveIds ? liveIds.size : g.itemIds.length} items selected
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setOpenExhibitId(null)}
                            className="rounded-xl px-3 py-1.5 text-[11px] text-white/40 hover:text-white transition"
                          >
                            Close
                          </button>
                          <button
                            onClick={() => saveExhibitItems(g.id)}
                            disabled={savingExhibit === g.id}
                            className="rounded-xl bg-amber-500 px-4 py-1.5 text-[11px] font-semibold text-black hover:bg-amber-400 transition disabled:opacity-50"
                          >
                            {savingExhibit === g.id ? "Saving…" : "Save Exhibit"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {editingItem && (
        <ItemEditModal
          item={editingItem}
          live={liveData.get(editingItem.id)}
          onSave={handleSaveItem}
          onClose={() => setEditingItem(null)}
        />
      )}
      {editingBio && (
        <BioEditModal
          char={char}
          currentBio={bio}
          onSave={handleSaveBio}
          onClose={() => setEditingBio(false)}
        />
      )}
      {editingExhibit && (
        <ExhibitEditModal
          exhibit={editingExhibit}
          profileId={char.profileId}
          onSave={handleSaveExhibit}
          onClose={() => setEditingExhibit(null)}
        />
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function AdminCharactersPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [selectedHandle, setSelectedHandle] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  if (!unlocked) return <AuthGate onUnlock={() => setUnlocked(true)} />;

  const filtered = ALL_CHARACTERS.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.displayName.toLowerCase().includes(q) ||
      c.handle.toLowerCase().includes(q) ||
      c.primaryFocus.toLowerCase().includes(q)
    );
  });

  const selected = ALL_CHARACTERS.find((c) => c.handle === selectedHandle) ?? null;

  const totalItems = ALL_CHARACTERS.reduce((s, c) => s + c.items.length, 0);
  const totalValue = ALL_CHARACTERS.reduce(
    (s, c) => s + c.items.reduce((ss, i) => ss + (i.currentValue ?? 0), 0),
    0
  );

  return (
    <div className="flex h-screen bg-[#0a0c12] text-white overflow-hidden">
      {/* Sidebar */}
      <div className="w-72 shrink-0 flex flex-col border-r border-white/8">
        <div className="shrink-0 p-4 border-b border-white/8">
          <div className="text-sm font-bold text-white">Character Admin</div>
          <div className="mt-0.5 text-[10px] text-white/40">
            {ALL_CHARACTERS.length} characters · {totalItems} items · {formatMoney(totalValue)}
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search characters..."
            className="mt-3 w-full rounded-xl bg-white/5 px-3 py-1.5 text-xs text-white ring-1 ring-white/10 focus:outline-none placeholder:text-white/30"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-3 grid gap-2">
          {filtered.map((char) => (
            <CharacterCard
              key={char.handle}
              char={char}
              isSelected={selectedHandle === char.handle}
              onClick={() => setSelectedHandle(char.handle)}
            />
          ))}
          {filtered.length === 0 && (
            <div className="text-center text-xs text-white/30 py-8">No characters found</div>
          )}
        </div>
        <div className="shrink-0 p-3 border-t border-white/8 text-[10px] text-white/25 text-center">
          Edit seedCharacters*.ts → run generateCharacterSeed.ts → paste SQL in Supabase
        </div>
      </div>

      {/* Detail */}
      <div className="flex-1 overflow-hidden bg-[#111318]">
        {selected ? (
          <CharacterDetail char={selected} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="text-4xl opacity-20">👤</div>
              <div className="mt-2 text-sm text-white/30">Select a character</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
