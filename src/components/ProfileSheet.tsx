"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getPrimaryImageUrl, type VaultItem } from "@/lib/vaultModel";
import type { PublicProfile, SocialLinks } from "@/lib/publicProfile";

// ── Design tokens ─────────────────────────────────────────────────
const C = {
  bg:     "rgba(9,14,26,0.98)",
  card:   "rgba(15,25,45,0.90)",
  bd:     "rgba(255,255,255,0.06)",
  gold:   "#F5B548",
  goldDim:"rgba(245,181,72,0.08)",
  goldBd: "rgba(245,181,72,0.20)",
  muted:  "#A0956B",
  muted2: "#635F59",
  text:   "#EDEBE3",
  r:      "var(--font-serif,'Cormorant Garamond',Georgia,serif)",
} as const;

// ── Social definitions ────────────────────────────────────────────
const SOCIAL_DEFS = [
  { key: "instagram" as const,  label: "IG",      icon: "📸", prefix: "https://instagram.com/" },
  { key: "twitter" as const,    label: "X",       icon: "𝕏",  prefix: "https://x.com/" },
  { key: "tiktok" as const,     label: "TT",      icon: "🎵", prefix: "https://tiktok.com/@" },
  { key: "youtube" as const,    label: "YT",      icon: "▶️", prefix: "https://youtube.com/@" },
  { key: "facebook" as const,   label: "FB",      icon: "👥", prefix: "https://facebook.com/" },
  { key: "whatnot" as const,    label: "WN",      icon: "🔨", prefix: "https://whatnot.com/user/" },
  { key: "ebay" as const,       label: "eBay",    icon: "🛒", prefix: "https://ebay.com/usr/" },
  { key: "website" as const,    label: "Site",    icon: "🌐", prefix: "" },
  { key: "linktree" as const,   label: "Links",   icon: "🌿", prefix: "https://linktr.ee/" },
] as const;

// ── Helpers ───────────────────────────────────────────────────────
function getTopSubjects(items: VaultItem[], limit = 4) {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const s = item.subject ?? item.category ?? item.universe;
    if (s) counts[s] = (counts[s] ?? 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([s]) => s);
}

function getTopGrade(items: VaultItem[]) {
  const nums = items.filter(i => i.grade).map(i => parseFloat(i.grade!)).filter(n => !isNaN(n));
  return nums.length ? Math.max(...nums) : null;
}

// ── Sub-components ────────────────────────────────────────────────
function SocialIcons({ links }: { links: SocialLinks }) {
  const active = SOCIAL_DEFS.filter(d => links[d.key]);
  if (!active.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center" }}>
      {active.map(def => {
        const val = links[def.key]!;
        const url = def.key === "website" ? val : def.prefix + val.replace(/^@/, "");
        return (
          <a key={def.key} href={url} target="_blank" rel="noopener noreferrer"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: "36px", height: "36px", borderRadius: "8px",
              background: C.goldDim, border: `1px solid ${C.goldBd}`,
              fontSize: "16px", textDecoration: "none", flexShrink: 0,
              transition: "background 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(245,181,72,0.15)")}
            onMouseLeave={e => (e.currentTarget.style.background = C.goldDim)}
          >
            {def.icon}
          </a>
        );
      })}
    </div>
  );
}

function ItemThumb({ item }: { item: VaultItem }) {
  const img = getPrimaryImageUrl(item);
  return (
    <div style={{
      borderRadius: "10px", overflow: "hidden",
      background: "rgba(10,18,35,0.9)", border: `1px solid ${C.bd}`,
      aspectRatio: "3/4",
    }}>
      {img
        ? <img src={img} alt={item.title ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", opacity: 0.2 }}>🖼️</div>}
    </div>
  );
}

function StatPill({ value, label }: { value: string | number; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", flex: 1 }}>
      <span style={{ fontFamily: C.r, fontSize: "20px", fontWeight: 700, color: C.gold, lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.16em", color: C.muted }}>{label}</span>
    </div>
  );
}

// ── Default banner gradient (dark vault feel) ─────────────────────
const BANNER_GRADIENTS = [
  "linear-gradient(160deg,#0A1220 0%,#1A2840 40%,#0D1A2E 70%,#060D1A 100%)",
  "linear-gradient(160deg,#120A20 0%,#2A1840 40%,#1A0D2E 70%,#0A060D 100%)",
  "linear-gradient(160deg,#0A1A14 0%,#1A3028 40%,#0D1E18 70%,#060E0C 100%)",
];

// ── Main component ────────────────────────────────────────────────
export interface ProfileSheetProps {
  profile: PublicProfile;
  items: VaultItem[];
  open: boolean;
  onClose: () => void;
}

export function ProfileSheet({ profile, items, open, onClose }: ProfileSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  // Mount → trigger enter animation
  useEffect(() => {
    if (open) {
      setMounted(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    } else {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), 320);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Close on backdrop click
  function handleBackdrop(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) return null;

  const displayName = profile.displayName ?? "Collector";
  const bio         = profile.bio ?? "";
  const socialLinks = profile.socialLinks ?? {};
  const avatarUrl   = profile.avatarUrl ?? "";
  const avatarEmoji = profile.avatarEmoji ?? "🗝️";
  const bannerUrl   = profile.bannerUrl ?? "";
  const gradedCount = items.filter(i => i.grade).length;
  const topGrade    = getTopGrade(items);
  const subjects    = getTopSubjects(items);
  const pinned      = items.slice(0, 6);

  // Pick a stable banner gradient based on name
  const bannerBg = bannerUrl
    ? `url(${bannerUrl}) center/cover no-repeat`
    : BANNER_GRADIENTS[(displayName.charCodeAt(0) ?? 0) % BANNER_GRADIENTS.length];

  return (
    <div
      onClick={handleBackdrop}
      style={{
        position: "fixed", inset: 0, zIndex: 60,
        background: `rgba(0,0,0,${visible ? 0.65 : 0})`,
        backdropFilter: visible ? "blur(4px)" : "none",
        transition: "background 0.28s, backdrop-filter 0.28s",
        display: "flex", alignItems: "flex-end",
      }}
    >
      <div
        ref={sheetRef}
        style={{
          width: "100%",
          maxWidth: "480px",
          margin: "0 auto",
          maxHeight: "88vh",
          background: C.bg,
          borderRadius: "22px 22px 0 0",
          border: `1px solid rgba(255,255,255,0.07)`,
          borderBottom: "none",
          overflowY: "auto",
          overflowX: "hidden",
          transform: `translateY(${visible ? "0" : "100%"})`,
          transition: "transform 0.32s cubic-bezier(0.32,0.72,0,1)",
          willChange: "transform",
        }}
      >
        {/* ── Drag handle ── */}
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
          <div style={{ width: "36px", height: "4px", borderRadius: "2px", background: "rgba(255,255,255,0.12)" }} />
        </div>

        {/* ── Banner ── */}
        <div style={{ position: "relative", height: "130px", background: bannerBg, margin: "0 0 44px" }}>
          {/* Subtle gold shimmer overlay */}
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(180deg,rgba(0,0,0,0) 40%,rgba(9,14,26,0.7) 100%)",
          }} />

          {/* Avatar — sits on banner edge */}
          <div style={{
            position: "absolute", bottom: "-38px", left: "50%",
            transform: "translateX(-50%)",
            width: "76px", height: "76px",
            borderRadius: "50%",
            border: "3px solid rgba(245,181,72,0.40)",
            boxShadow: "0 0 0 1px rgba(245,181,72,0.12), 0 4px 20px rgba(0,0,0,0.6)",
            background: avatarUrl ? `url(${avatarUrl}) center/cover` : "rgba(15,25,45,0.95)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: avatarUrl ? "0" : "32px",
            overflow: "hidden",
            zIndex: 1,
          }}>
            {!avatarUrl && avatarEmoji}
          </div>
        </div>

        {/* ── Identity block ── */}
        <div style={{ padding: "0 20px 16px", textAlign: "center" }}>
          <h2 style={{
            fontFamily: C.r, fontSize: "26px", fontWeight: 700,
            color: C.text, letterSpacing: "-0.02em", lineHeight: 1.1,
            marginBottom: bio ? "6px" : "0",
          }}>{displayName}</h2>

          {bio && (
            <p style={{ fontSize: "13px", color: "#C8BFA8", lineHeight: 1.55, marginBottom: "12px", maxWidth: "320px", margin: "6px auto 12px" }}>
              {bio}
            </p>
          )}

          <SocialIcons links={socialLinks} />
        </div>

        {/* ── Stats bar ── */}
        {items.length > 0 && (
          <div style={{
            display: "flex", margin: "0 16px 16px",
            background: "rgba(10,18,35,0.7)", border: `1px solid ${C.bd}`,
            borderRadius: "12px", padding: "12px 8px",
          }}>
            <StatPill value={items.length} label={items.length === 1 ? "Piece" : "Pieces"} />
            {gradedCount > 0 && <StatPill value={gradedCount} label="Graded" />}
            {topGrade !== null && <StatPill value={topGrade} label="Top Grade" />}
            {subjects.length > 0 && <StatPill value={subjects.length} label="Subjects" />}
          </div>
        )}

        {/* ── Collects ── */}
        {subjects.length > 0 && (
          <div style={{ padding: "0 16px 14px" }}>
            <div style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.22em", color: C.muted, marginBottom: "8px" }}>Collects</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {subjects.map(s => (
                <span key={s} style={{
                  fontSize: "11px", padding: "4px 10px", borderRadius: "20px",
                  background: C.goldDim, border: `1px solid ${C.goldBd}`, color: "#C8BFA8",
                }}>{s}</span>
              ))}
            </div>
          </div>
        )}

        {/* ── Pinned items grid ── */}
        {pinned.length > 0 && (
          <div style={{ padding: "0 16px 8px" }}>
            <div style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.22em", color: C.muted, marginBottom: "8px" }}>Collection</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "8px" }}>
              {pinned.map(item => <ItemThumb key={item.id} item={item} />)}
            </div>
          </div>
        )}

        {/* ── Empty state ── */}
        {items.length === 0 && (
          <div style={{ padding: "20px 16px", textAlign: "center" }}>
            <div style={{ fontSize: "30px", marginBottom: "8px" }}>📦</div>
            <div style={{ fontSize: "13px", color: C.muted }}>No public items yet</div>
          </div>
        )}

        {/* ── CTA ── */}
        <div style={{ padding: "16px 16px 28px", display: "flex", flexDirection: "column", gap: "10px", alignItems: "center" }}>
          <Link
            href={`/v/${profile.profileId}`}
            onClick={onClose}
            style={{
              display: "block", width: "100%", padding: "13px 0",
              background: C.goldDim, border: `1px solid ${C.goldBd}`,
              borderRadius: "11px", textAlign: "center",
              fontFamily: C.r, fontSize: "15px", fontWeight: 600,
              color: C.gold, textDecoration: "none",
              letterSpacing: "0.02em",
            }}
          >
            View Full Vault →
          </Link>
          <button
            onClick={onClose}
            style={{
              fontSize: "12px", color: C.muted2, background: "none",
              border: "none", cursor: "pointer", padding: "4px 8px",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
