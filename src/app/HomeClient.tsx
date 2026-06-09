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

// ── Social link definitions ──────────────────────────────────────
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

// ── CSS shorthand tokens (applied inline to avoid site-wide leakage) ─
const C = {
  bg1:    "rgba(19,19,19,0.97)",
  bg2:    "rgba(26,26,26,0.97)",
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

function focusToVaultSlug(focus: string): string | null {
  const t = focus.toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (/tcg|pokemon|magic|yugioh|tradingcard/.test(t)) return "tcg";
  if (/sports|memorabilia|jersey|baseball|basketball|football/.test(t)) return "sports";
  if (/vinyl|music|record|album/.test(t)) return "music";
  if (/jewelry|apparel|watch|streetwear|luxury/.test(t)) return "jewelry-apparel";
  if (/game|console|nintendo|playstation|xbox/.test(t)) return "games";
  if (/popculture|pop|comic|figure|funko|toy|manga|marvel|dc/.test(t)) return "pop-culture";
  if (/misc|other/.test(t)) return "misc";
  return null;
}

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

const BiggestMoversPanel = dynamic(() => import("@/components/BiggestMoversPanel"), {
  loading: () => <div className="border p-4 text-sm" style={{ background: C.card, borderColor: C.bd, borderRadius: "9px", color: C.muted }}>Loading movers…</div>,
});

function formatMoney(v?: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(v ?? 0));
}
function totalCost(item: VaultItem) {
  return Number(item.purchasePrice ?? 0) + Number(item.purchaseTax ?? 0) + Number(item.purchaseShipping ?? 0) + Number(item.purchaseFees ?? 0);
}
function itemTimestamp(item: VaultItem) {
  return Number(item.createdAt ?? item.valueUpdatedAt ?? item.priceUpdatedAt ?? 0);
}

// ── Bare stat: serif number + tiny label, no wrapper ────────────
function Stat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "gold" | "gain" | "loss" }) {
  const color = tone === "gold" ? C.gold : tone === "gain" ? C.green : tone === "loss" ? C.red : C.text;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
      <span style={{ fontFamily: C.r, fontSize: "22px", fontWeight: 700, lineHeight: 1, color }}>{value}</span>
      <span style={{ fontSize: "10px", color: C.muted2, letterSpacing: "0.1px", lineHeight: 1 }}>{label}</span>
    </div>
  );
}

// ── Card header: label + optional link ──────────────────────────
function CardHd({ label, href, linkText }: { label: string; href?: string; linkText?: string }) {
  return (
    <div style={{ padding: "11px 15px", borderBottom: `1px solid ${C.bd}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ fontSize: "10px", letterSpacing: "1.4px", textTransform: "uppercase", color: C.muted2, fontWeight: 600 }}>{label}</span>
      {href && linkText && <Link href={href} style={{ fontSize: "11px", color: C.gold }}>{linkText}</Link>}
    </div>
  );
}

// ── Exhibition Carousel ─────────────────────────────────────────
function ExhibitionCarousel({ galleries }: { galleries: Gallery[] }) {
  const [idx, setIdx] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);
  const n = galleries.length;
  function goNext() { setIdx((i) => (i + 1) % n); }
  function goPrev() { setIdx((i) => (i - 1 + n) % n); }

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    let startX = 0; let deltaX = 0;
    function onStart(e: TouchEvent) { startX = e.touches[0].clientX; deltaX = 0; }
    function onMove(e: TouchEvent) { deltaX = e.touches[0].clientX - startX; if (Math.abs(deltaX) > 8) e.preventDefault(); }
    function onEnd() { if (deltaX < -40) setIdx((i) => (i + 1) % n); else if (deltaX > 40) setIdx((i) => (i - 1 + n) % n); deltaX = 0; }
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    return () => { el.removeEventListener("touchstart", onStart); el.removeEventListener("touchmove", onMove); el.removeEventListener("touchend", onEnd); };
  }, [n]);

  const current = galleries[idx];
  const itemCount = current.itemIds?.length ?? 0;

  return (
    <section ref={sectionRef} style={{ touchAction: "pan-y", userSelect: "none" }}>
      {/* Thumbnail */}
      <Link href={"/gallery/" + current.id} style={{ display: "block", width: "100%", height: "88px", overflow: "hidden", border: `1px solid ${C.bd}`, borderRadius: "7px", background: "rgba(10,18,35,0.9)", position: "relative" }}>
        {current.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current.coverImage} alt={current.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", opacity: 0.2 }}>🏛️</div>
        )}
      </Link>

      <div style={{ marginTop: "10px" }}>
        <div style={{ fontFamily: C.r, fontSize: "16px", fontWeight: 600, lineHeight: 1.2, color: C.text }}>{current.title || "Untitled"}</div>
        <div style={{ fontSize: "11px", color: C.muted, marginTop: "3px" }}>
          {itemCount} piece{itemCount !== 1 ? "s" : ""}
          {n > 1 && <span style={{ marginLeft: "8px", opacity: 0.5 }}>{idx + 1}/{n}</span>}
        </div>
        <div style={{ display: "flex", gap: "8px", marginTop: "8px", alignItems: "center" }}>
          <Link href={"/gallery/" + current.id} style={{ display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "11px", color: C.gold }}>View Exhibition →</Link>
          {n > 1 && (
            <div style={{ display: "flex", gap: "4px", marginLeft: "auto" }}>
              <button onClick={goPrev} style={{ width: "22px", height: "22px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "5px", border: `1px solid ${C.goldBd}`, background: C.goldDim, color: C.gold, fontSize: "12px", cursor: "pointer" }}>‹</button>
              <button onClick={goNext} style={{ width: "22px", height: "22px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "5px", border: `1px solid ${C.goldBd}`, background: C.goldDim, color: C.gold, fontSize: "12px", cursor: "pointer" }}>›</button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ── Museum Rooms strip ──────────────────────────────────────────
function RoomsStrip({ galleries }: { galleries: Gallery[] }) {
  return (
    <div style={{ display: "flex", gap: "9px", padding: "12px 15px", overflowX: "auto" }}>
      {galleries.slice(0, 5).map((g) => (
        <Link key={g.id} href={"/gallery/" + g.id} style={{ flexShrink: 0, width: "86px", cursor: "pointer", textDecoration: "none" }}>
          <div style={{ width: "86px", height: "65px", borderRadius: "6px", border: `1px solid ${C.bd}`, background: "rgba(10,18,35,0.9)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {g.coverImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={g.coverImage} alt={g.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ fontSize: "20px", opacity: 0.2 }}>🏛️</span>
            )}
          </div>
          <div style={{ fontSize: "11px", fontWeight: 500, marginTop: "5px", color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.title}</div>
          <div style={{ fontSize: "10px", color: C.muted }}>{g.itemIds?.length ?? 0} pieces</div>
        </Link>
      ))}
      <Link href="/museum" style={{ flexShrink: 0, width: "86px", textDecoration: "none" }}>
        <div style={{ width: "86px", height: "65px", borderRadius: "6px", border: `1px solid ${C.goldBd}`, background: C.goldDim, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", color: C.gold, fontWeight: 600 }}>All →</div>
      </Link>
    </div>
  );
}

// ── Social Links Card ───────────────────────────────────────────
function SocialLinksCard({
  profileId, bio: initialBio, socialLinks: initialLinks, displayName, editable,
}: {
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
        {/* Bio */}
        {editing ? (
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell collectors about yourself…"
            rows={2}
            style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${C.goldBd}`, borderRadius: "6px", padding: "8px 10px", fontSize: "12px", color: C.text, resize: "none", outline: "none", fontFamily: "inherit", marginBottom: "12px" }}
            maxLength={300}
          />
        ) : bio ? (
          <p style={{ fontSize: "12px", lineHeight: 1.5, color: "#C8BFA8", marginBottom: "10px" }}>{bio}</p>
        ) : editable ? (
          <p style={{ fontSize: "11px", color: C.muted, opacity: 0.6, marginBottom: "10px", fontStyle: "italic" }}>Add a bio to let other collectors know who you are…</p>
        ) : null}

        {/* Social links — editing: row inputs; display: small flat tags */}
        {editing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
            {SOCIAL_DEFS.map((def) => (
              <div key={def.key} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "13px", width: "18px", textAlign: "center", flexShrink: 0 }}>{def.icon}</span>
                <span style={{ fontSize: "11px", color: C.muted, width: "72px", flexShrink: 0 }}>{def.label}</span>
                <input
                  value={links[def.key] ?? ""}
                  onChange={(e) => setLinks((prev) => ({ ...prev, [def.key]: e.target.value }))}
                  placeholder={def.key === "website" ? "https://yoursite.com" : "username"}
                  style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: `1px solid ${C.bd}`, borderRadius: "5px", padding: "5px 8px", fontSize: "11px", color: C.text, outline: "none", fontFamily: "inherit" }}
                />
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
                  <span style={{ fontSize: "12px" }}>{def.icon}</span>
                  <span>{def.label}</span>
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

// ── Recently Added sidebar items ────────────────────────────────
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
          {/* Thumbnail: real image at fixed size */}
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

// ── Main HomeClient ─────────────────────────────────────────────
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

      {/* ── MAIN GRID: left content + right sidebar ── */}
      <div style={{ maxWidth: "1200px", margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 265px", minHeight: "calc(100vh - 52px)", alignItems: "start" }}
        className="px-4 sm:px-5 lg:px-6 py-4 max-lg:grid-cols-1">

        {/* LEFT COLUMN */}
        <div style={{ display: "flex", flexDirection: "column", gap: "15px", paddingRight: "20px" }} className="max-lg:pr-0">

          {/* ── HERO CARD ── */}
          <div style={{ background: C.card, border: `1px solid ${C.bd}`, borderRadius: "10px", overflow: "hidden", display: "grid", gridTemplateColumns: "1fr 180px", minHeight: "190px", position: "relative" }}
            className="max-sm:grid-cols-1">
            {/* glow */}
            <div style={{ position: "absolute", top: "-60px", left: "-60px", width: "300px", height: "300px", background: "radial-gradient(circle, rgba(245,181,72,0.09) 0%, transparent 65%)", pointerEvents: "none" }} />

            <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", justifyContent: "space-between", position: "relative", zIndex: 1 }}>
              <div>
                <div style={{ fontSize: "11px", color: C.muted, letterSpacing: "0.08px", marginBottom: "2px" }}>
                  {stats.totalItems === 0 ? "Your vault is ready," : "Welcome back,"}
                </div>
                <h1 style={{ fontFamily: C.r, fontSize: "34px", fontWeight: 600, lineHeight: 1.04, color: C.text }}>{displayName || "Collector"}</h1>
                <div style={{ fontSize: "11.5px", color: C.muted2, marginTop: "4px" }}>
                  {stats.totalItems === 0 ? "Scan your first item to start building a real collection record." : summaryLine}
                </div>

                {/* Stats: bare numbers, no pill wrappers */}
                {stats.totalItems > 0 && (
                  <div style={{ display: "flex", gap: "22px", marginTop: "16px", flexWrap: "wrap" }}>
                    <Stat label="Items" value={String(stats.totalItems)} />
                    <Stat label="Invested" value={formatMoney(stats.totalCostValue)} />
                    <Stat label="Value" value={formatMoney(stats.totalValue)} tone="gold" />
                    {stats.totalCostValue > 0 && (
                      <Stat
                        label="Return"
                        value={gainPrefix + stats.gainPct.toFixed(1) + "%"}
                        tone={gainTone}
                      />
                    )}
                    {primaryFocus && primaryFocus.toLowerCase() !== "null" && (
                      <Stat label="Focus" value={primaryFocus} tone="gold" />
                    )}
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", gap: "9px", marginTop: "16px" }}>
                <div className="relative">
                  <div className="absolute -right-1 -top-1 z-10"><InfoTooltip text="Uses the camera + AI to identify an item automatically." /></div>
                  <Link href="/capture" style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: C.gold, color: "#080808", borderRadius: "6px", padding: "8px 14px", fontSize: "12px", fontWeight: 600, textDecoration: "none" }}>
                    Smart Scan
                  </Link>
                </div>
                <Link href="/vault" style={{ display: "inline-flex", alignItems: "center", background: "transparent", color: C.text, border: `1px solid ${C.bd}`, borderRadius: "6px", padding: "8px 14px", fontSize: "12px", fontWeight: 500, textDecoration: "none" }}>
                  Go to Vault
                </Link>
              </div>
            </div>

            {/* Right panel — decorative wall */}
            <div style={{ background: "linear-gradient(155deg, rgba(16,13,6,0.9), rgba(12,10,4,0.9))", position: "relative", overflow: "hidden" }} className="max-sm:hidden">
              <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, display: "flex", alignItems: "center", gap: "6px", padding: "10px", opacity: 0.25 }}>
                {[1,2,3].map((i) => (
                  <div key={i} style={{ flex: 1, height: "100%", borderRadius: "4px", background: "linear-gradient(160deg, #1A1610, #241C0C)", border: "1px solid rgba(245,181,72,0.15)" }} />
                ))}
              </div>
              <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 10%, rgba(245,181,72,0.18) 0%, transparent 60%)" }} />
            </div>
          </div>

          {/* ── EXHIBITIONS + ROOMS (2-col) ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }} className="max-sm:grid-cols-1">

            {/* Featured Exhibition */}
            <div style={{ background: C.card, border: `1px solid ${C.bd}`, borderRadius: "9px", overflow: "hidden" }}>
              <CardHd label="Featured Exhibition" />
              <div style={{ padding: "13px 15px" }}>
                {galleries.length > 0 ? (
                  <ExhibitionCarousel galleries={galleries} />
                ) : (
                  <div>
                    <div style={{ width: "100%", height: "88px", borderRadius: "7px", border: `1px solid ${C.bd}`, background: "rgba(10,18,35,0.9)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", opacity: 0.2 }}>🏛️</div>
                    <div style={{ fontFamily: C.r, fontSize: "15px", fontWeight: 600, color: C.text, marginTop: "10px" }}>No exhibitions yet</div>
                    <div style={{ fontSize: "11px", color: C.muted, marginTop: "3px" }}>Curate and share your collection.</div>
                    <Link href="/museum/new" style={{ display: "inline-flex", alignItems: "center", marginTop: "9px", fontSize: "11px", color: C.gold, textDecoration: "none" }}>Create Exhibition →</Link>
                  </div>
                )}
              </div>
            </div>

            {/* Museum Rooms */}
            <div style={{ background: C.card, border: `1px solid ${C.bd}`, borderRadius: "9px", overflow: "hidden" }}>
              <CardHd label="Museum Rooms" href="/museum" linkText="View all" />
              {galleries.length > 0 ? (
                <RoomsStrip galleries={galleries} />
              ) : (
                <div style={{ padding: "12px 15px", fontSize: "11px", color: C.muted, opacity: 0.6 }}>
                  Your exhibitions will appear here as rooms.
                </div>
              )}
            </div>
          </div>

          {/* ── SOCIAL / PROFILE ── */}
          {profileId && (
            <SocialLinksCard profileId={profileId} bio={bio} socialLinks={socialLinks} displayName={displayName} editable={true} />
          )}

          {/* ── QUICK ACTIONS + MOVERS ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }} className="max-sm:grid-cols-1">
            <div style={{ background: C.card, border: `1px solid ${C.bd}`, borderRadius: "9px", overflow: "hidden" }}>
              <CardHd label="Quick Actions" />
              <div style={{ padding: "12px 15px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "7px" }}>
                {([
                  { label: "Smart Scan", href: "/capture",     accent: true,  tip: "AI-powered item identification." },
                  { label: "Quick Add",  href: "/vault/quick", accent: false, tip: "Fast manual form — minimal fields." },
                  { label: "Add Item",   href: "/vault/add",   accent: false, tip: "Full detail entry with all fields." },
                  { label: "Vault",      href: "/vault",       accent: false, tip: "" },
                  { label: "Exhibit",    href: "/museum",      accent: false, tip: "" },
                  { label: "Account",    href: "/account",     accent: false, tip: "" },
                ] as { label: string; href: string; accent: boolean; tip: string }[]).map(({ label, href, accent, tip }) => (
                  <div key={href + label} className="relative">
                    {tip && <div className="absolute -right-1 -top-1 z-10"><InfoTooltip text={tip} /></div>}
                    <Link href={href} style={{
                      display: "block", width: "100%", borderRadius: "6px", border: accent ? `1px solid rgba(245,181,72,0.28)` : `1px solid ${C.bd}`,
                      background: accent ? "rgba(245,181,72,0.09)" : "rgba(255,255,255,0.03)",
                      color: accent ? C.gold : C.muted, padding: "9px 6px", textAlign: "center", fontSize: "11px", fontWeight: accent ? 600 : 500, textDecoration: "none"
                    }}>{label}</Link>
                  </div>
                ))}
              </div>
            </div>
            <BiggestMoversPanel items={items} />
          </div>

        </div>{/* end LEFT */}

        {/* RIGHT SIDEBAR */}
        <div style={{ display: "flex", flexDirection: "column", borderLeft: `1px solid ${C.bd}` }} className="max-lg:border-l-0 max-lg:border-t max-lg:mt-4">

          {/* Recently Added */}
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ padding: "13px 15px", borderBottom: `1px solid ${C.bd}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "10px", letterSpacing: "1.4px", textTransform: "uppercase", color: C.muted2, fontWeight: 600 }}>Recently Added</span>
              <Link href="/vault" style={{ fontSize: "11px", color: C.gold, textDecoration: "none" }}>View all</Link>
            </div>
            <RecentSidebarItems items={items} />
          </div>

          {/* Collection Value */}
          <div style={{ padding: "14px 15px", borderTop: `1px solid ${C.bd}` }}>
            <div style={{ fontSize: "10px", letterSpacing: "1.4px", textTransform: "uppercase", color: C.muted2, fontWeight: 600 }}>Collection Value</div>
            <div style={{ fontFamily: C.r, fontSize: "28px", fontWeight: 700, lineHeight: 1, marginTop: "9px", color: C.gold }}>{formatMoney(stats.totalValue)}</div>
            {stats.totalCostValue > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "5px", marginTop: "5px" }}>
                <span style={{ fontSize: "12px", fontWeight: 600, color: gainTone === "gain" ? C.green : C.red }}>
                  {gainTone === "gain" ? "▲" : "▼"} {gainPrefix}{stats.gainPct.toFixed(1)}%
                </span>
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

        </div>{/* end SIDEBAR */}

      </div>
    </main>
  );
}
