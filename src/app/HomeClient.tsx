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
      <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-bold leading-none cursor-default select-none" style={{ background: "rgba(245,181,72,0.15)", color: "#A0956B", border: "1px solid rgba(245,181,72,0.25)" }}>i</span>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-52 -translate-x-1/2 rounded-xl px-3 py-2 text-left text-xs leading-snug opacity-0 shadow-xl transition-opacity duration-150 group-hover/tip:opacity-100" style={{ background: "rgba(10,18,35,0.97)", border: "1px solid rgba(245,181,72,0.22)", color: "#D4C9A8" }}>
        {text}
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent" style={{ borderTopColor: "rgba(245,181,72,0.22)" }} />
      </span>
    </span>
  );
}

const BiggestMoversPanel = dynamic(() => import("@/components/BiggestMoversPanel"), {
  loading: () => <div className="rounded-[24px] border p-4 text-sm text-[#A0956B]" style={{ background: "var(--theme-card, rgba(15,25,45,0.85))", borderColor: "var(--theme-border, rgba(245,181,72,0.12))" }}>Loading movers...</div>,
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

function StatChip({ label, value, sub, tone = "default" }: { label: string; value: string; sub?: string; tone?: "default" | "gold" | "gain" | "loss" }) {
  const valueColor = tone === "gold" ? "#F5B548" : tone === "gain" ? "#4CAF82" : tone === "loss" ? "#E05252" : "#F0EAD6";
  return (
    <div className="flex flex-col gap-0.5 rounded-[14px] border px-3 py-2 flex-1 min-w-0" style={{ background: "var(--theme-card, rgba(15,25,45,0.85))", borderColor: "var(--theme-border, rgba(245,181,72,0.12))" }}>
      <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#A0956B]">{label}</span>
      <span className="text-base font-black tracking-[-0.04em] leading-none" style={{ color: valueColor }}>{value}</span>
      {sub && <span className="text-[9px] text-[#A0956B]">{sub}</span>}
    </div>
  );
}

// ── Exhibition Carousel ──────────────────────────────────────────
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
    <section ref={sectionRef} className="select-none" style={{ touchAction: "pan-y" }}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#A0956B]">
            Featured Exhibition <span className="opacity-40 ml-1">{idx + 1}/{n}</span>
          </p>
          <h2 className="mt-0.5 text-sm font-black tracking-[-0.02em] text-text-primary">{current.title || "Untitled"}</h2>
          <p className="text-[10px] text-[#A0956B] opacity-60">{itemCount} item{itemCount !== 1 ? "s" : ""}</p>
        </div>
        {n > 1 && (
          <div className="flex gap-1">
            <button onClick={goPrev} className="h-6 w-6 flex items-center justify-center rounded-full border text-xs transition" style={{ borderColor: "rgba(245,181,72,0.22)", background: "rgba(245,181,72,0.07)", color: "#F5B548" }}>‹</button>
            <button onClick={goNext} className="h-6 w-6 flex items-center justify-center rounded-full border text-xs transition" style={{ borderColor: "rgba(245,181,72,0.22)", background: "rgba(245,181,72,0.07)", color: "#F5B548" }}>›</button>
          </div>
        )}
      </div>

      {/* Thumbnail */}
      <Link href={"/gallery/" + current.id} className="block w-full overflow-hidden rounded-xl border transition hover:brightness-110" style={{ height: "120px", borderColor: "rgba(245,181,72,0.20)", background: "rgba(10,18,35,0.9)" }}>
        {current.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current.coverImage} alt={current.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl opacity-20">🏛️</div>
        )}
      </Link>

      <div className="mt-3 flex gap-2">
        <Link href={"/gallery/" + current.id} className="rounded-full px-3 py-1.5 text-xs font-black vltd-gold-btn">View →</Link>
        <Link href="/museum" className="rounded-full border px-3 py-1.5 text-xs font-semibold text-[#F5B548] transition hover:bg-[rgba(245,181,72,0.09)]" style={{ borderColor: "rgba(245,181,72,0.22)" }}>All exhibitions</Link>
      </div>
    </section>
  );
}

// ── Museum Rooms strip ───────────────────────────────────────────
function RoomsStrip({ galleries }: { galleries: Gallery[] }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#A0956B] mb-2">Museum Rooms</p>
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {galleries.slice(0, 6).map((g) => (
          <Link key={g.id} href={"/gallery/" + g.id} className="flex-shrink-0 group">
            <div className="w-20 h-14 rounded-lg overflow-hidden border transition group-hover:border-[rgba(245,181,72,0.40)]" style={{ borderColor: "rgba(245,181,72,0.12)", background: "rgba(10,18,35,0.9)" }}>
              {g.coverImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={g.coverImage} alt={g.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xl opacity-20">🏛️</div>
              )}
            </div>
            <p className="mt-1 text-[10px] font-medium text-text-primary truncate w-20">{g.title}</p>
            <p className="text-[9px] text-[#A0956B]">{g.itemIds?.length ?? 0} pieces</p>
          </Link>
        ))}
        <Link href="/museum" className="flex-shrink-0 flex flex-col items-center justify-center w-20">
          <div className="w-20 h-14 rounded-lg border flex items-center justify-center text-[#A0956B] text-xs font-semibold transition hover:text-[#F5B548]" style={{ borderColor: "rgba(245,181,72,0.12)", background: "rgba(245,181,72,0.04)" }}>All →</div>
        </Link>
      </div>
    </div>
  );
}

// ── Social Links Card ────────────────────────────────────────────
function SocialLinksCard({
  profileId,
  bio: initialBio,
  socialLinks: initialLinks,
  displayName,
  editable,
}: {
  profileId: string;
  bio: string;
  socialLinks: SocialLinks;
  displayName: string;
  editable: boolean;
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
    } finally {
      setSaving(false);
    }
  }, [bio, links, profileId]);

  if (!editable && !hasAny) return null;

  return (
    <div className="rounded-[24px] border p-4" style={{ background: "var(--theme-card, rgba(15,25,45,0.85))", borderColor: "var(--theme-border, rgba(245,181,72,0.12))" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#A0956B]">
          {editable ? "Your Profile" : displayName}
        </p>
        {editable && !editing && (
          <button onClick={() => setEditing(true)} className="text-[11px] font-semibold text-[#A0956B] hover:text-[#F5B548] transition">
            ✏️ Edit
          </button>
        )}
        {editing && (
          <div className="flex gap-2">
            <button onClick={() => { setEditing(false); setBio(initialBio); setLinks(initialLinks); }} className="text-[11px] text-[#A0956B] hover:text-white transition">Cancel</button>
            <button onClick={save} disabled={saving} className="rounded-full px-3 py-1 text-[11px] font-bold transition" style={{ background: "rgba(245,181,72,0.15)", color: "#F5B548", border: "1px solid rgba(245,181,72,0.30)" }}>{saving ? "Saving…" : "Save"}</button>
          </div>
        )}
      </div>

      {/* Bio */}
      {editing ? (
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Tell collectors about yourself — your focus, how long you've been collecting, what drives you…"
          rows={3}
          className="w-full rounded-xl border px-3 py-2 text-xs text-white resize-none focus:outline-none mb-3"
          style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(245,181,72,0.20)" }}
          maxLength={300}
        />
      ) : bio ? (
        <p className="text-sm leading-relaxed text-[#C8BFA8] mb-3">{bio}</p>
      ) : editable ? (
        <p className="text-xs text-[#A0956B] opacity-60 mb-3 italic">Add a bio to let other collectors know who you are…</p>
      ) : null}

      {/* Social links */}
      {editing ? (
        <div className="grid grid-cols-1 gap-2">
          {SOCIAL_DEFS.map((def) => (
            <div key={def.key} className="flex items-center gap-2">
              <span className="text-sm w-5 text-center shrink-0">{def.icon}</span>
              <span className="text-[11px] text-[#A0956B] w-20 shrink-0">{def.label}</span>
              <input
                value={links[def.key] ?? ""}
                onChange={(e) => setLinks((prev) => ({ ...prev, [def.key]: e.target.value }))}
                placeholder={def.key === "website" ? "https://yoursite.com" : "username"}
                className="flex-1 rounded-lg border px-2 py-1.5 text-[11px] text-white focus:outline-none"
                style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(245,181,72,0.16)" }}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {SOCIAL_DEFS.filter((d) => links[d.key]).map((def) => {
            const val = links[def.key]!;
            const url = def.key === "website" ? val : def.prefix + val.replace(/^@/, "");
            return (
              <a key={def.key} href={url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition hover:brightness-125"
                style={{ borderColor: "rgba(245,181,72,0.22)", background: "rgba(245,181,72,0.06)", color: "#C8BFA8" }}>
                <span>{def.icon}</span>
                <span>{def.label}</span>
              </a>
            );
          })}
          {editable && !Object.values(links).some(Boolean) && (
            <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 rounded-full border border-dashed px-3 py-1.5 text-xs text-[#A0956B] transition hover:text-[#F5B548]" style={{ borderColor: "rgba(245,181,72,0.20)" }}>
              + Add social links
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Recently Added sidebar items ─────────────────────────────────
function RecentSidebarItems({ items }: { items: VaultItem[] }) {
  const recent = useMemo(() => [...items].sort((a, b) => itemTimestamp(b) - itemTimestamp(a)).slice(0, 6), [items]);
  if (recent.length === 0) return (
    <div className="px-4 py-3 text-xs text-[#A0956B] opacity-60">No items yet — scan your first collectible.</div>
  );
  return (
    <div className="flex-1 overflow-y-auto">
      {recent.map((item) => (
        <Link key={item.id} href={"/vault/item/" + item.id}
          className="flex items-center gap-2.5 px-4 py-2.5 border-b transition hover:bg-[rgba(245,181,72,0.04)]"
          style={{ borderColor: "rgba(255,255,255,0.04)" }}>
          <div className="w-8 h-8 rounded-lg border overflow-hidden flex-shrink-0 flex items-center justify-center text-sm"
            style={{ borderColor: "rgba(245,181,72,0.14)", background: "rgba(10,18,35,0.9)" }}>
            {item.imageFrontUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.imageFrontUrl} alt="" className="w-full h-full object-cover" />
            ) : "📦"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold truncate text-text-primary">{item.title}</p>
            <p className="text-[10px] text-[#A0956B]">{item.universe || item.category || "Collectible"}</p>
          </div>
          <p className="text-xs font-semibold shrink-0 tabular-nums" style={{ color: "#52D6F4" }}>{formatMoney(item.currentValue ?? item.estimatedValue ?? 0)}</p>
        </Link>
      ))}
    </div>
  );
}

// ── Main HomeClient ──────────────────────────────────────────────
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

  const gainTone = stats.totalGain >= 0 ? "gain" : "loss";
  const gainPrefix = stats.totalGain >= 0 ? "+" : "";
  const summaryLine = stats.totalGain >= 0
    ? "Your vault is up " + formatMoney(stats.totalGain) + " overall."
    : "Your vault is down " + formatMoney(Math.abs(stats.totalGain)) + " overall.";

  void profileType;

  if (loading) return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-6xl rounded-[24px] border p-5 text-[#A0956B]" style={{ background: "var(--theme-card, rgba(15,25,45,0.85))", borderColor: "var(--theme-border, rgba(245,181,72,0.12))" }}>Loading dashboard...</div>
    </main>
  );
  if (error) return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-6xl rounded-[24px] border border-red-500/40 bg-red-500/10 p-5 text-red-100">{error}</div>
    </main>
  );

  return (
    <main className="min-h-screen px-4 py-4 text-[color:var(--fg)] sm:px-5 lg:px-6">
      <div className="mx-auto max-w-[1200px]">

        {/* ── TOP ROW: Hero (left) + Sidebar (right) ── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_260px]">

          {/* LEFT COLUMN */}
          <div className="space-y-4">

            {/* Hero card */}
            <section className="rounded-[24px] border overflow-hidden relative" style={{ background: "var(--theme-card, rgba(15,25,45,0.85))", borderColor: "rgba(245,181,72,0.18)", boxShadow: "0 0 60px rgba(245,181,72,0.05)" }}>
              <div className="pointer-events-none absolute -right-8 -top-8 h-64 w-64 rounded-full" style={{ background: "radial-gradient(circle, rgba(245,181,72,0.10) 0%, transparent 70%)", filter: "blur(32px)" }} />
              <div className="p-4 sm:p-5 relative z-10">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#A0956B]">
                      {stats.totalItems === 0 ? "Your vault is ready," : "Welcome back,"}
                    </p>
                    <h1 className="mt-0.5 text-2xl font-black tracking-[-0.04em] text-text-primary sm:text-3xl">{displayName || "Collector"}</h1>
                    <p className="mt-1 text-sm text-[#A0956B]">
                      {stats.totalItems === 0 ? "Scan your first item to start building a real collection record." : summaryLine}
                    </p>
                  </div>
                  {primaryFocus && primaryFocus.toLowerCase() !== "null" && (() => {
                    const slug = focusToVaultSlug(primaryFocus);
                    const inner = (<><p className="text-[10px] uppercase tracking-[0.18em] text-[#A0956B]">Focus</p><p className="text-sm font-bold text-[#F5B548]">{primaryFocus}</p></>);
                    return slug
                      ? <Link href={"/vault/" + slug} className="shrink-0 rounded-2xl border px-3 py-1.5 text-right transition hover:brightness-110" style={{ borderColor: "rgba(245,181,72,0.22)", background: "rgba(245,181,72,0.07)" }}>{inner}</Link>
                      : <div className="shrink-0 rounded-2xl border px-3 py-1.5 text-right" style={{ borderColor: "rgba(245,181,72,0.22)", background: "rgba(245,181,72,0.07)" }}>{inner}</div>;
                  })()}
                </div>

                {/* Stats row */}
                {stats.totalItems > 0 && (
                  <div className="mt-4 flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
                    <StatChip label="Items" value={String(stats.totalItems)} sub="in vault" />
                    <StatChip label="Invested" value={formatMoney(stats.totalCostValue)} sub="cost basis" />
                    <StatChip label="Value" value={formatMoney(stats.totalValue)} sub="current est." tone="gold" />
                    <StatChip label="Gain / Loss" value={gainPrefix + formatMoney(stats.totalGain)} sub={stats.totalCostValue > 0 ? gainPrefix + stats.gainPct.toFixed(1) + "% return" : "add costs"} tone={gainTone} />
                  </div>
                )}

                {/* Smart Scan CTA */}
                <div className="relative mt-4">
                  <div className="absolute -right-1 -top-1 z-10"><InfoTooltip text="Uses the camera + AI to identify an item automatically. Point at a card, figure, or comic and it fills in the details for you." /></div>
                  <Link href="/capture" className="flex min-h-[48px] items-center justify-between gap-3 rounded-[18px] px-4 py-3 font-semibold no-select transition hover:-translate-y-0.5" style={{ background: "linear-gradient(135deg, rgba(139,105,20,0.25) 0%, rgba(200,148,31,0.15) 50%, rgba(139,105,20,0.25) 100%)", border: "1px solid var(--theme-gold-border, rgba(245,181,72,0.35))", boxShadow: "0 0 20px rgba(245,181,72,0.15)", color: "var(--theme-gold, #F5B548)" }}>
                    <span className="flex items-center gap-3 text-sm font-semibold">
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--theme-gold-subtle, rgba(245,181,72,0.10))", border: "1px solid var(--theme-gold-border, rgba(245,181,72,0.25))" }}>⬛</span>
                      Smart Scan — add any item to your VLTD vault instantly
                    </span>
                    <span className="hidden shrink-0 text-sm font-semibold sm:inline">Scan →</span>
                  </Link>
                </div>
              </div>
            </section>

            {/* Exhibitions + Rooms */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Featured Exhibition */}
              <div className="rounded-[24px] border p-4" style={{ background: "var(--theme-card, rgba(15,25,45,0.85))", borderColor: "var(--theme-border, rgba(245,181,72,0.12))" }}>
                {galleries.length > 0 ? (
                  <ExhibitionCarousel galleries={galleries} />
                ) : (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#A0956B] mb-2">Featured Exhibition</p>
                    <div className="w-full h-[120px] rounded-xl border flex items-center justify-center text-3xl opacity-20" style={{ borderColor: "rgba(245,181,72,0.12)", background: "rgba(10,18,35,0.9)" }}>🏛️</div>
                    <div className="mt-3">
                      <p className="text-sm font-bold text-text-primary">No exhibitions yet</p>
                      <p className="text-xs text-[#A0956B] mt-0.5">Curate and share your collection with the world.</p>
                      <Link href="/museum/new" className="inline-block mt-3 rounded-full px-3 py-1.5 text-xs font-black vltd-gold-btn">Create Exhibition →</Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Museum Rooms */}
              <div className="rounded-[24px] border p-4" style={{ background: "var(--theme-card, rgba(15,25,45,0.85))", borderColor: "var(--theme-border, rgba(245,181,72,0.12))" }}>
                {galleries.length > 0 ? (
                  <RoomsStrip galleries={galleries} />
                ) : (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#A0956B] mb-2">Museum Rooms</p>
                    <p className="text-xs text-[#A0956B] opacity-60">Your exhibitions will appear here as rooms.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Social / Personal card */}
            {profileId && (
              <SocialLinksCard
                profileId={profileId}
                bio={bio}
                socialLinks={socialLinks}
                displayName={displayName}
                editable={true}
              />
            )}

            {/* Quick Actions + Movers row */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <section className="rounded-[24px] border p-4" style={{ background: "var(--theme-card, rgba(15,25,45,0.85))", borderColor: "var(--theme-border, rgba(245,181,72,0.12))" }}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#A0956B] mb-3">Quick Actions</p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { label: "Quick Add", href: "/vault/quick", accent: true,  tip: "Fast manual form — minimal fields, designed for speed." },
                    { label: "Import",    href: "/vault/import", accent: false, tip: "" },
                    { label: "Vault",     href: "/vault",        accent: false, tip: "" },
                    { label: "Exhibit",   href: "/museum",       accent: false, tip: "" },
                    { label: "Add Item",  href: "/vault/add",    accent: false, tip: "Full detail entry — all fields including grade, purchase price, and more." },
                    { label: "Account",   href: "/account",      accent: false, tip: "" },
                  ] as { label: string; href: string; accent: boolean; tip: string }[]).map(({ label, href, accent, tip }) => (
                    <div key={href + label} className="relative">
                      {tip && <div className="absolute -right-1 -top-1 z-10"><InfoTooltip text={tip} /></div>}
                      <Link href={href} className="block w-full rounded-2xl border px-3 py-3 text-center text-sm font-semibold transition" style={accent ? { borderColor: "rgba(245,181,72,0.28)", background: "rgba(245,181,72,0.09)", color: "#F5B548" } : { borderColor: "var(--theme-border, rgba(245,181,72,0.12))", background: "var(--theme-elevated, rgba(20,32,55,0.9))", color: "#A0956B" }}>{label}</Link>
                    </div>
                  ))}
                </div>
              </section>
              <BiggestMoversPanel items={items} />
            </div>

          </div>{/* end LEFT COLUMN */}

          {/* RIGHT SIDEBAR */}
          <div className="flex flex-col gap-4">

            {/* Activity / Recently Added */}
            <div className="rounded-[24px] border overflow-hidden flex flex-col" style={{ background: "var(--theme-card, rgba(15,25,45,0.85))", borderColor: "var(--theme-border, rgba(245,181,72,0.12))" }}>
              <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "rgba(245,181,72,0.08)" }}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#A0956B]">Recently Added</p>
                <Link href="/vault" className="text-[11px] text-[#F5B548] font-semibold">View all</Link>
              </div>
              <RecentSidebarItems items={items} />
            </div>

            {/* Collection Value */}
            <div className="rounded-[24px] border p-4" style={{ background: "var(--theme-card, rgba(15,25,45,0.85))", borderColor: "var(--theme-border, rgba(245,181,72,0.12))" }}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#A0956B]">Collection Value</p>
              <p className="font-black tracking-[-0.04em] leading-none mt-2" style={{ fontFamily: "var(--font-serif, Georgia, serif)", fontSize: "26px", color: "#F5B548" }}>{formatMoney(stats.totalValue)}</p>
              {stats.totalCostValue > 0 && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-semibold" style={{ color: gainTone === "gain" ? "#4CAF82" : "#E05252" }}>
                    {gainTone === "gain" ? "▲" : "▼"} {gainPrefix}{stats.gainPct.toFixed(1)}%
                  </span>
                  <span className="text-[10px] text-[#A0956B]">overall return</span>
                </div>
              )}
              {/* Mini sparkline */}
              <svg viewBox="0 0 220 44" width="100%" height="36" style={{ marginTop: "12px" }}>
                <defs>
                  <linearGradient id="vg2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F5B548" stopOpacity=".25"/>
                    <stop offset="100%" stopColor="#F5B548" stopOpacity=".02"/>
                  </linearGradient>
                </defs>
                <path d="M0 40 C30 38 55 34 80 28 C105 22 135 14 165 9 C185 6 200 4 220 2 L220 44 L0 44Z" fill="url(#vg2)"/>
                <path d="M0 40 C30 38 55 34 80 28 C105 22 135 14 165 9 C185 6 200 4 220 2" fill="none" stroke="#F5B548" strokeWidth="1.6"/>
                <circle cx="220" cy="2" r="2.5" fill="#F5B548"/>
              </svg>
              <Link href="/vault/sold" className="mt-2 block text-center text-[11px] font-semibold text-[#A0956B] hover:text-[#F5B548] transition">View analytics →</Link>
            </div>

          </div>{/* end SIDEBAR */}

        </div>{/* end TOP ROW */}

      </div>
    </main>
  );
}
