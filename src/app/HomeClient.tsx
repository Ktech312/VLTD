"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getOnboardingStatus } from "@/lib/auth";
import { loadItems, syncVaultItemsFromSupabase, type VaultItem } from "@/lib/vaultModel";
import { loadGalleries, refreshGalleriesFromSupabase, type Gallery } from "@/lib/galleryModel";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

const FOCUS_LS_KEY = "vltd_primary_focus";

// ── Design tokens (home-only, no site-wide leakage) ─────────────
const C = {
  card:   "var(--theme-card, rgba(15,25,45,0.90))",
  bd:     "rgba(255,255,255,0.06)",
  bd2:    "rgba(255,255,255,0.03)",
  gold:   "#F5B548",
  goldDim:"rgba(245,181,72,0.08)",
  goldBd: "rgba(245,181,72,0.20)",
  muted:  "#A0956B",
  muted2: "#635F59",
  text:   "#EDEBE3",
  green:  "#52C27A",
  red:    "#E05252",
  r:      "var(--font-serif, 'Cormorant Garamond', Georgia, serif)",
} as const;

// ── Social platforms ─────────────────────────────────────────────
const SOCIAL_DEFS = [
  { key: "instagram",  label: "Instagram",  icon: "📸", prefix: "https://instagram.com/" },
  { key: "twitter",    label: "X / Twitter",icon: "𝕏",  prefix: "https://x.com/" },
  { key: "tiktok",     label: "TikTok",     icon: "🎵", prefix: "https://tiktok.com/@" },
  { key: "youtube",    label: "YouTube",    icon: "▶️", prefix: "https://youtube.com/@" },
  { key: "facebook",   label: "Facebook",   icon: "👥", prefix: "https://facebook.com/" },
  { key: "whatnot",    label: "Whatnot",    icon: "🔨", prefix: "https://whatnot.com/user/" },
  { key: "ebay",       label: "eBay Store", icon: "🛒", prefix: "https://ebay.com/usr/" },
  { key: "website",    label: "Website",    icon: "🌐", prefix: "" },
  { key: "linktree",   label: "Linktree",   icon: "🌿", prefix: "https://linktr.ee/" },
] as const;
type SocialKey = typeof SOCIAL_DEFS[number]["key"];
type SocialLinks = Partial<Record<SocialKey, string>>;

// ── Avatar presets ────────────────────────────────────────────────
const AVATAR_PRESETS = [
  { id: "key",     emoji: "🗝️", bg: "linear-gradient(145deg,#2C1E08,#5E3E0E)" },
  { id: "lion",    emoji: "🦁", bg: "linear-gradient(145deg,#3E2800,#7A5000)" },
  { id: "dragon",  emoji: "🐉", bg: "linear-gradient(145deg,#0A2E1A,#1A5E32)" },
  { id: "fox",     emoji: "🦊", bg: "linear-gradient(145deg,#3E1A00,#7A3800)" },
  { id: "eagle",   emoji: "🦅", bg: "linear-gradient(145deg,#0A1A2E,#1A3A5E)" },
  { id: "gem",     emoji: "💎", bg: "linear-gradient(145deg,#0A1E3E,#1A3A7A)" },
  { id: "orb",     emoji: "🔮", bg: "linear-gradient(145deg,#1A0A3E,#3A1A7A)" },
  { id: "sword",   emoji: "⚔️", bg: "linear-gradient(145deg,#1E1E1E,#3A3A3A)" },
  { id: "cards",   emoji: "🃏", bg: "linear-gradient(145deg,#2E0A0A,#5E1A1A)" },
  { id: "crown",   emoji: "👑", bg: "linear-gradient(145deg,#2E2200,#5E4400)" },
  { id: "vault",   emoji: "🏛️", bg: "linear-gradient(145deg,#1A1A2E,#2E2E4E)" },
  { id: "fire",    emoji: "🔥", bg: "linear-gradient(145deg,#3E0A00,#7A1A00)" },
];

// ── Helpers ───────────────────────────────────────────────────────
function focusToVaultSlug(focus: string): string | null {
  const t = focus.toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (/tcg|pokemon|magic|yugioh|tradingcard/.test(t)) return "tcg";
  if (/sports|memorabilia|jersey|baseball|basketball|football/.test(t)) return "sports";
  if (/vinyl|music|record|album/.test(t)) return "music";
  if (/jewelry|apparel|watch|streetwear|luxury/.test(t)) return "jewelry-apparel";
  if (/game|console|nintendo|playstation|xbox/.test(t)) return "games";
  if (/popculture|pop|comic|figure|funko|toy|manga|marvel|dc/.test(t)) return "pop-culture";
  return null;
}
function formatMoney(v?: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(v ?? 0));
}
function totalCost(item: VaultItem) {
  return Number(item.purchasePrice ?? 0) + Number(item.purchaseTax ?? 0) + Number(item.purchaseShipping ?? 0) + Number(item.purchaseFees ?? 0);
}
function itemTimestamp(item: VaultItem) {
  return Number(item.createdAt ?? item.valueUpdatedAt ?? item.priceUpdatedAt ?? 0);
}

const BiggestMoversPanel = dynamic(() => import("@/components/BiggestMoversPanel"), {
  loading: () => <div style={{ background: C.card, border: `1px solid ${C.bd}`, borderRadius: "9px", padding: "16px", fontSize: "13px", color: C.muted }}>Loading movers…</div>,
});

// ── Tooltip ───────────────────────────────────────────────────────
function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="group/tip relative inline-flex items-center justify-center">
      <span className="flex h-3.5 w-3.5 items-center justify-center text-[8px] font-bold leading-none cursor-default select-none" style={{ background: "rgba(245,181,72,0.12)", color: C.muted, border: "1px solid rgba(245,181,72,0.20)", borderRadius: "50%" }}>i</span>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-52 -translate-x-1/2 px-3 py-2 text-left text-xs leading-snug opacity-0 shadow-xl transition-opacity duration-150 group-hover/tip:opacity-100" style={{ background: "rgba(10,18,35,0.97)", border: "1px solid rgba(245,181,72,0.22)", color: "#D4C9A8", borderRadius: "6px" }}>
        {text}
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent" style={{ borderTopColor: "rgba(245,181,72,0.22)" }} />
      </span>
    </span>
  );
}

// ── Bare stat: serif number + tiny label ──────────────────────────
function Stat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "gold" | "gain" | "loss" }) {
  const color = tone === "gold" ? C.gold : tone === "gain" ? C.green : tone === "loss" ? C.red : C.text;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
      <span style={{ fontFamily: C.r, fontSize: "22px", fontWeight: 700, lineHeight: 1, color }}>{value}</span>
      <span style={{ fontSize: "10px", color: C.muted2, letterSpacing: "0.1px" }}>{label}</span>
    </div>
  );
}

// ── Card header ───────────────────────────────────────────────────
function CardHd({ label, href, linkText }: { label: string; href?: string; linkText?: string }) {
  return (
    <div style={{ padding: "11px 15px", borderBottom: `1px solid ${C.bd}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ fontSize: "10px", letterSpacing: "1.4px", textTransform: "uppercase", color: C.muted2, fontWeight: 600 }}>{label}</span>
      {href && linkText && <Link href={href} style={{ fontSize: "11px", color: C.gold, textDecoration: "none" }}>{linkText}</Link>}
    </div>
  );
}

// ── Avatar Picker Modal ───────────────────────────────────────────
function AvatarPickerModal({
  profileId, currentUrl, onClose, onSaved,
}: {
  profileId: string;
  currentUrl: string;
  onClose: () => void;
  onSaved: (url: string) => void;
}) {
  const [selected, setSelected] = useState<string>(currentUrl);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const presetUrl = (id: string) => `__preset:${id}`;
  const isPreset = (url: string) => url.startsWith("__preset:");
  const presetIdFromUrl = (url: string) => url.replace("__preset:", "");

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return;
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${profileId}/avatar.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setSelected(data.publicUrl + "?t=" + Date.now());
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return;
      const urlToSave = isPreset(selected) ? selected : selected;
      await supabase.from("profiles").update({ avatar_url: urlToSave }).eq("id", profileId);
      onSaved(urlToSave);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  // Render current avatar preview
  const currentPreset = isPreset(selected) ? AVATAR_PRESETS.find(p => p.id === presetIdFromUrl(selected)) : null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }} onClick={onClose}>
      <div style={{ background: "#131313", border: `1px solid ${C.goldBd}`, borderRadius: "10px", width: "100%", maxWidth: "400px", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.bd}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "13px", fontWeight: 600, color: C.text }}>Change Avatar</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, fontSize: "18px", cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: "16px" }}>
          {/* Current preview */}
          <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "16px" }}>
            <div style={{ width: "64px", height: "64px", borderRadius: "50%", border: `2px solid ${C.goldBd}`, overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: currentPreset?.bg ?? "#1A1A1A", fontSize: "28px" }}>
              {!isPreset(selected) && selected ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selected} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                currentPreset?.emoji ?? "🗝️"
              )}
            </div>
            <div>
              <div style={{ fontSize: "12px", color: C.text, fontWeight: 500 }}>Your avatar</div>
              <div style={{ fontSize: "11px", color: C.muted, marginTop: "2px" }}>Pick a preset or upload your own photo</div>
            </div>
          </div>

          {/* Preset grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "8px", marginBottom: "14px" }}>
            {AVATAR_PRESETS.map((p) => {
              const isActive = selected === presetUrl(p.id);
              return (
                <button key={p.id} onClick={() => setSelected(presetUrl(p.id))}
                  style={{ width: "100%", aspectRatio: "1", borderRadius: "50%", border: isActive ? `2px solid ${C.gold}` : `1px solid ${C.bd}`, background: p.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", cursor: "pointer", outline: "none", position: "relative" }}>
                  {p.emoji}
                  {isActive && <span style={{ position: "absolute", bottom: 0, right: 0, width: "14px", height: "14px", background: C.gold, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "8px", color: "#000", fontWeight: 700 }}>✓</span>}
                </button>
              );
            })}
          </div>

          {/* Upload */}
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleUpload} />
          <button onClick={() => fileInputRef.current?.click()}
            style={{ width: "100%", padding: "9px", borderRadius: "6px", border: `1px dashed ${C.goldBd}`, background: "none", color: C.muted, fontSize: "12px", cursor: "pointer", marginBottom: "14px" }}>
            {uploading ? "Uploading…" : "📷  Upload your own photo"}
          </button>

          {/* Save / Cancel */}
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={onClose} style={{ flex: 1, padding: "9px", borderRadius: "6px", border: `1px solid ${C.bd}`, background: "none", color: C.muted, fontSize: "12px", cursor: "pointer" }}>Cancel</button>
            <button onClick={handleSave} disabled={saving}
              style={{ flex: 2, padding: "9px", borderRadius: "6px", border: "none", background: C.gold, color: "#000", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
              {saving ? "Saving…" : "Save Avatar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Hero Avatar Panel (clickable) ─────────────────────────────────
function HeroAvatarPanel({ avatarUrl, onClick }: { avatarUrl: string; onClick: () => void }) {
  const preset = avatarUrl.startsWith("__preset:")
    ? AVATAR_PRESETS.find(p => p.id === avatarUrl.replace("__preset:", ""))
    : null;
  const hasCustom = avatarUrl && !avatarUrl.startsWith("__preset:");

  return (
    <button onClick={onClick} style={{ position: "relative", width: "100%", height: "100%", background: preset?.bg ?? "linear-gradient(155deg,#100D06,#0C0A04)", border: "none", cursor: "pointer", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }} className="max-sm:hidden">
      {/* Ambient glow */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 10%, rgba(245,181,72,0.18) 0%, transparent 60%)", pointerEvents: "none" }} />
      {/* Decorative wall frames behind */}
      {!hasCustom && (
        <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, display: "flex", alignItems: "center", gap: "6px", padding: "10px", opacity: 0.18, pointerEvents: "none" }}>
          {[1,2,3].map((i) => <div key={i} style={{ flex: 1, height: "100%", borderRadius: "4px", background: "linear-gradient(160deg,#1A1610,#241C0C)", border: "1px solid rgba(245,181,72,0.15)" }} />)}
        </div>
      )}
      {/* Avatar display */}
      {hasCustom ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }} />
      ) : (
        <span style={{ fontSize: "64px", position: "relative", zIndex: 1, filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.8))" }}>
          {preset?.emoji ?? "🗝️"}
        </span>
      )}
      {/* Edit hint overlay */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0)", display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: "12px", opacity: 0, transition: "all 0.2s" }}
        className="hover:!opacity-100 hover:!bg-[rgba(0,0,0,0.4)]">
        <span style={{ fontSize: "11px", color: C.gold, fontWeight: 600, background: "rgba(0,0,0,0.6)", borderRadius: "4px", padding: "3px 8px" }}>Change avatar</span>
      </div>
    </button>
  );
}

// ── Featured Gallery card (left, static — always shows galleries[0]) ──
function FeaturedGalleryCard({ galleries }: { galleries: Gallery[] }) {
  const g = galleries[0];
  const itemCount = g.itemIds?.length ?? 0;
  return (
    <div style={{ padding: "12px 14px" }}>
      <Link href={"/gallery/" + g.id} style={{ display: "block", width: "100%", height: "200px", borderRadius: "10px", border: `2px solid rgba(245,181,72,0.65)`, boxShadow: "0 0 0 1px rgba(245,181,72,0.18), 0 8px 32px rgba(0,0,0,0.45)", background: "rgba(10,18,35,0.9)", overflow: "hidden" }}>
        {g.coverImage
          ? <img src={g.coverImage} alt={g.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", opacity: 0.2 }}>🖼️</div>}
      </Link>
      <div style={{ marginTop: "9px" }}>
        <div style={{ fontFamily: C.r, fontSize: "15px", fontWeight: 600, color: C.text }}>{g.title || "Untitled"}</div>
        <div style={{ fontSize: "11px", color: C.muted, marginTop: "2px" }}>{itemCount} piece{itemCount !== 1 ? "s" : ""}</div>
        <Link href={"/gallery/" + g.id} style={{ display: "inline-flex", alignItems: "center", marginTop: "7px", fontSize: "11px", color: C.gold, textDecoration: "none" }}>View Gallery →</Link>
      </div>
    </div>
  );
}

// ── Featured Gallery carousel (coverflow, compact) ──────────────
function FeaturedGalleryCarousel({ galleries }: { galleries: Gallery[] }) {
  const [idx, setIdx] = useState(0);
  const startX = useRef<number>(0);
  const dragX = useRef<number>(0);
  const dragging = useRef(false);
  const n = galleries.length;

  function goNext() { setIdx((i) => (i + 1) % n); }
  function goPrev() { setIdx((i) => (i - 1 + n) % n); }

  function onTouchStart(e: React.TouchEvent) { startX.current = e.touches[0].clientX; dragX.current = 0; }
  function onTouchMove(e: React.TouchEvent) { dragX.current = e.touches[0].clientX - startX.current; }
  function onTouchEnd() { if (dragX.current < -40) goNext(); else if (dragX.current > 40) goPrev(); dragX.current = 0; }
  function onMouseDown(e: React.MouseEvent) { dragging.current = true; startX.current = e.clientX; dragX.current = 0; }
  function onMouseMove(e: React.MouseEvent) { if (!dragging.current) return; dragX.current = e.clientX - startX.current; }
  function onMouseUp() { if (!dragging.current) return; dragging.current = false; if (dragX.current < -40) goNext(); else if (dragX.current > 40) goPrev(); dragX.current = 0; }
  function onMouseLeave() { if (dragging.current) { dragging.current = false; if (dragX.current < -40) goNext(); else if (dragX.current > 40) goPrev(); dragX.current = 0; } }

  const current = galleries[idx];
  const itemCount = current.itemIds?.length ?? 0;
  const slots = [-1, 0, 1, 2].map((offset) => ({ g: galleries[(idx + offset + n) % n], offset }));

  return (
    <div className="relative select-none" style={{ cursor: "grab", padding: "12px" }}
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseLeave}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
        <div>
          <p style={{ fontSize: "9px", fontWeight: 600, letterSpacing: "0.28em", textTransform: "uppercase", color: C.muted }}>
            Featured Gallery <span style={{ opacity: 0.5, marginLeft: "6px" }}>{idx + 1} / {n}</span>
          </p>
          <h2 style={{ fontSize: "13px", fontWeight: 700, color: C.text, marginTop: "2px" }}>{current.title || "Untitled"}</h2>
          <p style={{ fontSize: "11px", color: C.muted, marginTop: "1px" }}>{itemCount} piece{itemCount !== 1 ? "s" : ""}</p>
        </div>
        {n > 1 && (
          <div style={{ display: "flex", gap: "4px" }}>
            <button type="button" onClick={goPrev} style={{ width: "24px", height: "24px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", border: `1px solid ${C.goldBd}`, background: C.goldDim, color: C.gold, fontSize: "14px", cursor: "pointer" }}>‹</button>
            <button type="button" onClick={goNext} style={{ width: "24px", height: "24px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", border: `1px solid ${C.goldBd}`, background: C.goldDim, color: C.gold, fontSize: "14px", cursor: "pointer" }}>›</button>
          </div>
        )}
      </div>
      {/* Coverflow */}
      <div style={{ position: "relative", height: "120px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {slots.map(({ g, offset }) => {
          const isActive = offset === 0;
          const tx = offset === -1 ? "-80px" : offset === 0 ? "0px" : offset === 1 ? "72px" : "110px";
          const scale = isActive ? 1 : Math.abs(offset) === 1 ? 0.70 : 0.52;
          const opacity = isActive ? 1 : Math.abs(offset) === 1 ? 0.55 : 0.25;
          const zIndex = isActive ? 10 : Math.abs(offset) === 1 ? 5 : 1;
          return (
            <button key={g.id + String(offset)} type="button"
              onClick={offset < 0 ? goPrev : offset > 0 ? goNext : undefined}
              className="absolute overflow-hidden transition-all duration-300"
              style={{ width: "86px", height: "114px", borderRadius: "10px",
                transform: `translateX(${tx}) scale(${scale})`, opacity, zIndex,
                border: isActive ? `2px solid rgba(245,181,72,0.55)` : `1px solid rgba(245,181,72,0.14)`,
                background: "rgba(10,18,35,0.9)",
                boxShadow: isActive ? "0 8px 28px rgba(0,0,0,0.55)" : "none",
                cursor: isActive ? "default" : "pointer" }}>
              {g.coverImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={g.coverImage} alt={g.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} draggable={false} />
              ) : (
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", opacity: 0.2 }}>🖼️</div>
              )}
            </button>
          );
        })}
      </div>
      {/* Buttons */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "10px" }}>
        <Link href={"/gallery/" + current.id} style={{ borderRadius: "6px", padding: "6px 14px", fontSize: "11px", fontWeight: 700, background: `linear-gradient(135deg,#8B6914,#F5B548)`, color: "#0B0B0B", textDecoration: "none" }}>View Gallery →</Link>
        <Link href="/museum" style={{ borderRadius: "6px", border: `1px solid ${C.goldBd}`, padding: "5px 12px", fontSize: "11px", fontWeight: 600, color: C.gold, textDecoration: "none" }}>All Galleries</Link>
      </div>
      {/* Dots */}
      {n > 1 && (
        <div style={{ display: "flex", gap: "4px", marginTop: "8px" }}>
          {galleries.map((_, di) => (
            <button key={di} type="button" onClick={() => setIdx(di)} style={{ height: "3px", borderRadius: "2px", border: "none", transition: "all 0.3s", width: di === idx ? "14px" : "4px", background: di === idx ? C.gold : "rgba(245,181,72,0.22)", cursor: "pointer" }} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Collections strip (swipe carousel) ───────────────────────────
function CollectionsStrip({ galleries }: { galleries: Gallery[] }) {
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el: HTMLDivElement = stripRef.current!;
    if (!el) return;
    let startX = 0; let scrollStart = 0; let isDragging = false;
    function onStart(e: TouchEvent) {
      startX = e.touches[0].clientX;
      scrollStart = el.scrollLeft;
      isDragging = true;
    }
    function onMove(e: TouchEvent) {
      if (!isDragging) return;
      const delta = startX - e.touches[0].clientX;
      el.scrollLeft = scrollStart + delta;
      if (Math.abs(delta) > 6) e.preventDefault();
    }
    function onEnd() { isDragging = false; }
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    return () => { el.removeEventListener("touchstart", onStart); el.removeEventListener("touchmove", onMove); el.removeEventListener("touchend", onEnd); };
  }, []);

  return (
    <div ref={stripRef} style={{ display: "flex", gap: "9px", padding: "12px 15px", overflowX: "auto", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}
      className="no-scrollbar">
      {galleries.slice(0, 6).map((g) => (
        <Link key={g.id} href={"/gallery/" + g.id}
          style={{ flexShrink: 0, width: "86px", cursor: "pointer", textDecoration: "none", scrollSnapAlign: "start" }}>
          <div style={{ width: "86px", height: "65px", borderRadius: "6px", border: `1px solid ${C.bd}`, background: "rgba(10,18,35,0.9)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {g.coverImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={g.coverImage} alt={g.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ fontSize: "20px", opacity: 0.2 }}>🖼️</span>
            )}
          </div>
          <div style={{ fontSize: "11px", fontWeight: 500, marginTop: "5px", color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.title}</div>
          <div style={{ fontSize: "10px", color: C.muted }}>{g.itemIds?.length ?? 0} pieces</div>
        </Link>
      ))}
      <Link href="/museum" style={{ flexShrink: 0, width: "86px", textDecoration: "none", scrollSnapAlign: "start" }}>
        <div style={{ width: "86px", height: "65px", borderRadius: "6px", border: `1px solid ${C.goldBd}`, background: C.goldDim, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", color: C.gold, fontWeight: 600 }}>All →</div>
      </Link>
    </div>
  );
}

// ── Social Links Card ─────────────────────────────────────────────
function SocialLinksCard({ profileId, bio: initialBio, socialLinks: initialLinks, displayName, editable }: {
  profileId: string; bio: string; socialLinks: SocialLinks; displayName: string; editable: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState(initialBio);
  const [links, setLinks] = useState<SocialLinks>(initialLinks);
  const [saving, setSaving] = useState(false);
  const hasAny = bio.trim() || Object.values(links).some(Boolean);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return;
      await supabase.from("profiles").update({ bio: bio.trim(), social_links: links }).eq("id", profileId);
      setEditing(false);
    } finally { setSaving(false); }
  }, [bio, links, profileId]);

  if (!editable && !hasAny) return null;

  return (
    <div style={{ background: C.card, border: `1px solid ${C.bd}`, borderRadius: "9px", overflow: "hidden" }}>
      <div style={{ padding: "11px 15px", borderBottom: `1px solid ${C.bd}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "10px", letterSpacing: "1.4px", textTransform: "uppercase", color: C.muted2, fontWeight: 600 }}>
          {editable ? "Your Profile" : displayName}
        </span>
        {editable && !editing && (
          <button onClick={() => setEditing(true)} style={{ fontSize: "11px", color: C.muted, cursor: "pointer", background: "none", border: "none" }}>Edit</button>
        )}
        {editing && (
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={() => { setEditing(false); setBio(initialBio); setLinks(initialLinks); }} style={{ fontSize: "11px", color: C.muted, cursor: "pointer", background: "none", border: "none" }}>Cancel</button>
            <button onClick={save} disabled={saving} style={{ fontSize: "11px", fontWeight: 600, color: C.gold, cursor: "pointer", background: "none", border: "none" }}>{saving ? "Saving…" : "Save"}</button>
          </div>
        )}
      </div>
      <div style={{ padding: "12px 15px" }}>
        {editing ? (
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell collectors about yourself…" rows={2}
            style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${C.goldBd}`, borderRadius: "6px", padding: "8px 10px", fontSize: "12px", color: C.text, resize: "none", outline: "none", fontFamily: "inherit", marginBottom: "12px" }} maxLength={300} />
        ) : bio ? (
          <p style={{ fontSize: "12px", lineHeight: 1.5, color: "#C8BFA8", marginBottom: "10px" }}>{bio}</p>
        ) : editable ? (
          <p style={{ fontSize: "11px", color: C.muted, opacity: 0.6, marginBottom: "10px", fontStyle: "italic" }}>Add a bio to let other collectors know who you are…</p>
        ) : null}
        {editing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
            {SOCIAL_DEFS.map((def) => (
              <div key={def.key} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "13px", width: "18px", textAlign: "center", flexShrink: 0 }}>{def.icon}</span>
                <span style={{ fontSize: "11px", color: C.muted, width: "72px", flexShrink: 0 }}>{def.label}</span>
                <input value={links[def.key] ?? ""} onChange={(e) => setLinks((prev) => ({ ...prev, [def.key]: e.target.value }))}
                  placeholder={def.key === "website" ? "https://yoursite.com" : "username"}
                  style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: `1px solid ${C.bd}`, borderRadius: "5px", padding: "5px 8px", fontSize: "11px", color: C.text, outline: "none", fontFamily: "inherit" }} />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
            {SOCIAL_DEFS.filter((d) => links[d.key]).map((def) => {
              const val = links[def.key]!;
              const url = def.key === "website" ? val : def.prefix + val.replace(/^@/, "");
              return (
                <a key={def.key} href={url} target="_blank" rel="noopener noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: "5px", borderRadius: "4px", border: `1px solid ${C.goldBd}`, background: C.goldDim, padding: "4px 8px", fontSize: "11px", color: "#C8BFA8", textDecoration: "none" }}>
                  <span style={{ fontSize: "12px" }}>{def.icon}</span><span>{def.label}</span>
                </a>
              );
            })}
            {editable && !Object.values(links).some(Boolean) && (
              <button onClick={() => setEditing(true)} style={{ display: "inline-flex", alignItems: "center", gap: "4px", borderRadius: "4px", border: `1px dashed ${C.goldBd}`, background: "none", padding: "4px 8px", fontSize: "11px", color: C.muted, cursor: "pointer" }}>
                + Add social links
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Recently Added sidebar ────────────────────────────────────────
function RecentSidebarItems({ items }: { items: VaultItem[] }) {
  const recent = useMemo(() => [...items].sort((a, b) => itemTimestamp(b) - itemTimestamp(a)).slice(0, 6), [items]);
  if (recent.length === 0) return (
    <div style={{ padding: "12px 15px", fontSize: "11px", color: C.muted, opacity: 0.6 }}>No items yet — scan your first collectible.</div>
  );
  return (
    <div style={{ flex: 1, overflowY: "auto" }}>
      {recent.map((item) => (
        <Link key={item.id} href={"/vault/item/" + item.id}
          style={{ display: "flex", gap: "9px", padding: "10px 15px", borderBottom: `1px solid ${C.bd2}`, alignItems: "center", textDecoration: "none" }}>
          <div style={{ width: "32px", height: "32px", flexShrink: 0, borderRadius: "5px", border: `1px solid ${C.bd}`, background: "rgba(10,18,35,0.9)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px" }}>
            {item.imageFrontUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.imageFrontUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : "📦"}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: "12px", fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</div>
            <div style={{ fontSize: "11px", color: C.muted }}>{item.universe || item.category || "Collectible"}</div>
          </div>
          <div style={{ fontSize: "12px", fontWeight: 600, flexShrink: 0, color: "#52D6F4", fontVariantNumeric: "tabular-nums" }}>{formatMoney(item.currentValue ?? item.estimatedValue ?? 0)}</div>
        </Link>
      ))}
    </div>
  );
}

// ── Main HomeClient ───────────────────────────────────────────────
export default function HomeClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [profileType, setProfileType] = useState("");
  const [primaryFocus, setPrimaryFocus] = useState("");
  const [profileId, setProfileId] = useState("");
  const [bio, setBio] = useState("");
  const [socialLinks, setSocialLinks] = useState<SocialLinks>({});
  const [avatarUrl, setAvatarUrl] = useState("__preset:key");
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [galleries, setGalleries] = useState<Gallery[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true); setError("");
      try {
        const status = await getOnboardingStatus();
        if (!status.isAuthenticated) { router.replace("/login"); return; }
        if (status.needsOnboarding) { router.replace("/onboarding"); return; }
        const profile = status.activeProfile;
        setDisplayName(profile?.display_name ?? "");
        setProfileType(profile?.profile_type ?? "");
        setProfileId(profile?.id ?? "");
        setBio((profile as Record<string, unknown>)?.bio as string ?? "");
        setSocialLinks(((profile as Record<string, unknown>)?.social_links as SocialLinks) ?? {});
        const savedAvatar = (profile as Record<string, unknown>)?.avatar_url as string | null;
        setAvatarUrl(savedAvatar || "__preset:key");
        const focus = profile?.primary_focus ?? "";
        setPrimaryFocus(focus);
        try { window.localStorage.setItem(FOCUS_LS_KEY, focus); } catch { /* ignore */ }
        await syncVaultItemsFromSupabase();
        setItems(loadItems());
        void refreshGalleriesFromSupabase(true).then(() => {
          setGalleries(loadGalleries().filter((g) => g.state === "ACTIVE" && g.visibility === "PUBLIC"));
        });
        setGalleries(loadGalleries().filter((g) => g.state === "ACTIVE" && g.visibility === "PUBLIC"));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard.");
      } finally { setLoading(false); }
    }
    void load();
  }, [router]);

  const stats = useMemo(() => {
    const totalItems = items.length;
    const totalCostValue = items.reduce((sum, item) => sum + totalCost(item), 0);
    const totalValue = items.reduce((sum, item) => sum + Number(item.currentValue ?? 0), 0);
    const totalGain = totalValue - totalCostValue;
    const gainPct = totalCostValue > 0 ? (totalGain / totalCostValue) * 100 : 0;
    return { totalItems, totalCostValue, totalValue, totalGain, gainPct };
  }, [items]);

  const gainTone = stats.totalGain >= 0 ? "gain" as const : "loss" as const;
  const gainPrefix = stats.totalGain >= 0 ? "+" : "";
  const summaryLine = stats.totalGain >= 0
    ? "Your vault is up " + formatMoney(stats.totalGain) + " overall."
    : "Your vault is down " + formatMoney(Math.abs(stats.totalGain)) + " overall.";

  void profileType;

  if (loading) return (
    <main style={{ minHeight: "100vh", padding: "32px 22px" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", background: C.card, border: `1px solid ${C.bd}`, borderRadius: "10px", padding: "16px", fontSize: "13px", color: C.muted }}>Loading dashboard…</div>
    </main>
  );
  if (error) return (
    <main style={{ minHeight: "100vh", padding: "32px 22px" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", background: "rgba(224,82,82,0.08)", border: "1px solid rgba(224,82,82,0.30)", borderRadius: "10px", padding: "16px", color: "#f8c0c0" }}>{error}</div>
    </main>
  );

  return (
    <main style={{ minHeight: "100vh", color: C.text }}>

      {/* Avatar picker modal */}
      {showAvatarPicker && profileId && (
        <AvatarPickerModal
          profileId={profileId}
          currentUrl={avatarUrl}
          onClose={() => setShowAvatarPicker(false)}
          onSaved={(url) => setAvatarUrl(url)}
        />
      )}

      <div style={{ maxWidth: "1200px", margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 265px", alignItems: "start" }}
        className="px-4 sm:px-5 lg:px-6 py-4 max-lg:grid-cols-1">

        {/* ── LEFT COLUMN ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "15px", paddingRight: "20px" }} className="max-lg:pr-0">

          {/* Hero card */}
          <div style={{ background: C.card, border: `1px solid ${C.bd}`, borderRadius: "10px", overflow: "hidden", display: "grid", gridTemplateColumns: "1fr 180px", minHeight: "190px", position: "relative" }}
            className="max-sm:grid-cols-1">
            <div style={{ position: "absolute", top: "-60px", left: "-60px", width: "300px", height: "300px", background: "radial-gradient(circle, rgba(245,181,72,0.08) 0%, transparent 65%)", pointerEvents: "none" }} />

            <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", justifyContent: "space-between", position: "relative", zIndex: 1 }}>
              <div>
                <div style={{ fontSize: "11px", color: C.muted, marginBottom: "2px" }}>
                  {stats.totalItems === 0 ? "Your vault is ready," : "Welcome back,"}
                </div>
                <h1 style={{ fontFamily: C.r, fontSize: "34px", fontWeight: 600, lineHeight: 1.04, color: C.text }}>{displayName || "Collector"}</h1>
                <div style={{ fontSize: "11.5px", color: C.muted2, marginTop: "4px" }}>
                  {stats.totalItems === 0 ? "Scan your first item to start building a real collection record." : summaryLine}
                </div>
                {stats.totalItems > 0 && (
                  <div style={{ display: "flex", gap: "22px", marginTop: "16px", flexWrap: "wrap" }}>
                    <Stat label="Items" value={String(stats.totalItems)} />
                    <Stat label="Invested" value={formatMoney(stats.totalCostValue)} />
                    <Stat label="Value" value={formatMoney(stats.totalValue)} tone="gold" />
                    {stats.totalCostValue > 0 && <Stat label="Return" value={gainPrefix + stats.gainPct.toFixed(1) + "%"} tone={gainTone} />}
                    {primaryFocus && primaryFocus.toLowerCase() !== "null" && <Stat label="Focus" value={primaryFocus} tone="gold" />}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: "9px", marginTop: "16px" }}>
                <div className="relative">
                  <div className="absolute -right-1 -top-1 z-10"><InfoTooltip text="AI-powered item identification — point camera at any collectible." /></div>
                  <Link href="/capture" style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: C.gold, color: "#080808", borderRadius: "6px", padding: "9px 16px", fontSize: "12px", fontWeight: 600, textDecoration: "none" }}>Smart Scan</Link>
                </div>
                <Link href="/vault" style={{ display: "inline-flex", alignItems: "center", background: "transparent", color: C.text, border: `1px solid ${C.bd}`, borderRadius: "6px", padding: "8px 14px", fontSize: "12px", fontWeight: 500, textDecoration: "none" }}>Go to Vault</Link>
              </div>
            </div>

            {/* Avatar panel — clickable */}
            <HeroAvatarPanel avatarUrl={avatarUrl} onClick={() => setShowAvatarPicker(true)} />
          </div>

          {/* Featured Gallery card (left) + coverflow carousel (right) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }} className="max-sm:grid-cols-1">
            <div style={{ background: C.card, border: `1px solid ${C.bd}`, borderRadius: "9px", overflow: "hidden" }}>
              <CardHd label="Featured Gallery" />
              {galleries.length > 0 ? (
                <FeaturedGalleryCard galleries={galleries} />
              ) : (
                <div style={{ padding: "16px" }}>
                  <div style={{ fontFamily: C.r, fontSize: "15px", fontWeight: 600, color: C.text }}>No galleries yet</div>
                  <Link href="/museum/new" style={{ display: "inline-flex", marginTop: "8px", fontSize: "11px", color: C.gold, textDecoration: "none" }}>Create Gallery →</Link>
                </div>
              )}
            </div>
            <div style={{ background: C.card, border: `1px solid ${C.bd}`, borderRadius: "9px", overflow: "hidden" }}>
              <CardHd label="Active Exhibitions" href="/museum" linkText="All" />
              {galleries.length > 0 ? (
                <FeaturedGalleryCarousel galleries={galleries} />
              ) : (
                <div style={{ padding: "12px 15px", fontSize: "11px", color: C.muted, opacity: 0.6 }}>Your galleries will appear here.</div>
              )}
            </div>
          </div>


          {/* Your Profile */}
          {profileId && (
            <SocialLinksCard profileId={profileId} bio={bio} socialLinks={socialLinks} displayName={displayName} editable={true} />
          )}

          {/* Quick Actions + Movers */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }} className="max-sm:grid-cols-1">
            <div style={{ background: C.card, border: `1px solid ${C.bd}`, borderRadius: "9px", overflow: "hidden" }}>
              <CardHd label="Quick Actions" />
              <div style={{ padding: "12px 15px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "7px" }}>
                {([
                  { label: "Smart Scan", href: "/capture",     accent: true,  tip: "AI-powered item identification." },
                  { label: "Quick Add",  href: "/vault/quick", accent: false, tip: "Fast manual form — minimal fields." },
                  { label: "Add Item",   href: "/vault/add",   accent: false, tip: "Full detail entry with all fields." },
                  { label: "Vault",      href: "/vault",       accent: false, tip: "" },
                  { label: "Galleries",  href: "/museum",      accent: false, tip: "" },
                  { label: "Account",    href: "/account",     accent: false, tip: "" },
                ] as { label: string; href: string; accent: boolean; tip: string }[]).map(({ label, href, accent, tip }) => (
                  <div key={href + label} className="relative">
                    {tip && <div className="absolute -right-1 -top-1 z-10"><InfoTooltip text={tip} /></div>}
                    <Link href={href} style={{
                      display: "block", width: "100%", borderRadius: "6px",
                      border: accent ? "1px solid rgba(245,181,72,0.28)" : `1px solid ${C.bd}`,
                      background: accent ? "rgba(245,181,72,0.09)" : "rgba(255,255,255,0.03)",
                      color: accent ? C.gold : C.muted,
                      padding: "9px 6px", textAlign: "center", fontSize: "11px", fontWeight: accent ? 600 : 500, textDecoration: "none"
                    }}>{label}</Link>
                  </div>
                ))}
              </div>
            </div>
            <BiggestMoversPanel items={items} />
          </div>

        </div>{/* end LEFT */}

        {/* ── RIGHT SIDEBAR ── */}
        <div style={{ display: "flex", flexDirection: "column", borderLeft: `1px solid ${C.bd}` }} className="max-lg:border-l-0 max-lg:border-t max-lg:mt-4">
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ padding: "13px 15px", borderBottom: `1px solid ${C.bd}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "10px", letterSpacing: "1.4px", textTransform: "uppercase", color: C.muted2, fontWeight: 600 }}>Recently Added</span>
              <Link href="/vault" style={{ fontSize: "11px", color: C.gold, textDecoration: "none" }}>View all</Link>
            </div>
            <RecentSidebarItems items={items} />
          </div>

          <div style={{ padding: "14px 15px", borderTop: `1px solid ${C.bd}` }}>
            <div style={{ fontSize: "10px", letterSpacing: "1.4px", textTransform: "uppercase", color: C.muted2, fontWeight: 600 }}>Collection Value</div>
            <div style={{ fontFamily: C.r, fontSize: "28px", fontWeight: 700, lineHeight: 1, marginTop: "9px", color: C.gold }}>{formatMoney(stats.totalValue)}</div>
            {stats.totalCostValue > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "5px", marginTop: "5px" }}>
                <span style={{ fontSize: "12px", fontWeight: 600, color: gainTone === "gain" ? C.green : C.red }}>{gainTone === "gain" ? "▲" : "▼"} {gainPrefix}{stats.gainPct.toFixed(1)}%</span>
                <span style={{ fontSize: "11px", color: C.muted }}>overall return</span>
              </div>
            )}
            <svg viewBox="0 0 230 52" width="100%" height="44" style={{ marginTop: "12px" }}>
              <defs>
                <linearGradient id="vg3" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.gold} stopOpacity=".28"/>
                  <stop offset="100%" stopColor={C.gold} stopOpacity=".02"/>
                </linearGradient>
              </defs>
              <path d="M0 46 C20 44 35 40 55 35 C75 30 90 26 110 22 C130 18 150 12 170 9 C190 6 210 4 230 2 L230 52 L0 52Z" fill="url(#vg3)"/>
              <path d="M0 46 C20 44 35 40 55 35 C75 30 90 26 110 22 C130 18 150 12 170 9 C190 6 210 4 230 2" fill="none" stroke={C.gold} strokeWidth="1.8"/>
              <circle cx="230" cy="2" r="2.5" fill={C.gold}/>
            </svg>
            <Link href="/vault/sold" style={{ display: "block", textAlign: "center", marginTop: "8px", fontSize: "11px", color: C.muted, textDecoration: "none" }}>View analytics →</Link>
          </div>

        </div>{/* end RIGHT SIDEBAR */}

      </div>
    </main>
  );
}
