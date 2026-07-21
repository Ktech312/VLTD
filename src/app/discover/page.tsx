"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { getCurrentUser, getOnboardingStatus } from "@/lib/auth";
import { getSeedAvatarUrlForProfile, isRenderableAvatarUrl } from "@/lib/seedAvatar";
import DiscoverSwipe from "@/components/DiscoverSwipe";
import { type UniverseKey, UNIVERSE_KEYS, UNIVERSE_LABEL, isUniverseKey } from "@/lib/taxonomy";
import { loadItems } from "@/lib/vaultModel";
import { loadWatchlist } from "@/lib/watchlistModel";
import { Glyph } from "@/components/ui/Glyph";
import { buildUserPreferences, sortByPersonalization } from "@/lib/personalization";

const TABS: Array<"All" | UniverseKey> = ["All", ...UNIVERSE_KEYS];

// Realistic universe thumbnail images — stored in /public/universe-thumbnails/
const UNIVERSE_THUMB: Record<UniverseKey, string> = {
  POP_CULTURE:      "/universe-thumbnails/pop-culture.png",
  SPORTS:           "/universe-thumbnails/sports.png",
  TCG:              "/universe-thumbnails/tcg.png",
  MUSIC:            "/universe-thumbnails/music.png",
  JEWELRY_APPAREL:  "/universe-thumbnails/jewelry-apparel.png",
  GAMES:            "/universe-thumbnails/games.png",
  BUILT_BOTANY:     "/universe-thumbnails/built-botany.png",
  MISC:             "/universe-thumbnails/misc.png",
  AUTOMOTIVE:       "/universe-thumbnails/automotive.png",
  ART:              "/universe-thumbnails/art.png",
};

type PublicGallery = {
  id: string;
  title: string;
  description: string | null;
  cover_image: string | null;
  profile_id: string;
  analytics_views: number;
  item_count: number;
  theme_pack: string | null;
  layout: Record<string, unknown> | null;
  itemIds: string[];
  /** Computed once at fetch time from the gallery's actual items - see computeGalleryUniverse. */
  universeKey: UniverseKey;
  collector_name?: string;
  collector_avatar?: string;
  collector_avatar_url?: string;
};

function normalizeForSearch(value: unknown) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// Fallback only - used when a gallery has no resolvable items (e.g. all items were
// deleted, or none matched the vault_items lookup). Real classification below uses
// the gallery's actual item universes instead of guessing from title/description text.
function inferUniverseKeyFromText(gallery: Pick<PublicGallery, "title" | "description" | "theme_pack">): UniverseKey {
  const text = normalizeForSearch([gallery.title, gallery.description, gallery.theme_pack].filter(Boolean).join(" "));
  const includes = (...terms: string[]) => terms.some((t) => text.includes(t));
  if (includes("pokemon", "magic", "yugioh", "yu gi oh", "tcg", "trading card", "card game", "slab", "foil", "single")) return "TCG";
  if (includes("sports", "rookie", "jersey", "autograph", "memorabilia", "baseball", "basketball", "football", "soccer", "hockey")) return "SPORTS";
  if (includes("vinyl", "album", "music", "record", "instrument", "signed lp", "turntable", "jazz", "harmonica", "guitar", "piano", "symphony")) return "MUSIC";
  if (includes("watch", "jewelry", "apparel", "streetwear", "luxury", "handbag", "limited drop", "jewel", "necklace", "diamond")) return "JEWELRY_APPAREL";
  if (includes("game", "console", "nintendo", "playstation", "xbox", "sega", "atari", "cartridge", "arcade", "controller")) return "GAMES";
  if (includes("comic", "marvel", " dc ", "figure", "toy", "manga", "funko", "prop", "statue", "pop culture")) return "POP_CULTURE";
  if (includes("handmade", "ceramic", "woodwork", "metalwork", "textile", "resin", "leatherwork", "origami", "succulent", "tropical", "cacti", "bonsai", "terrarium", "plant", "botany", "garden")) return "BUILT_BOTANY";
  return "MISC";
}

// Real classification: majority vote across the gallery's actual item universes
// (looked up from vault_items), falling back to the text heuristic only when none
// of the gallery's items resolve to a known universe.
function computeGalleryUniverse(
  itemIds: string[],
  itemUniverseMap: Map<string, UniverseKey>,
  gallery: Pick<PublicGallery, "title" | "description" | "theme_pack">
): UniverseKey {
  const counts = new Map<UniverseKey, number>();
  for (const id of itemIds) {
    const u = itemUniverseMap.get(id);
    if (u) counts.set(u, (counts.get(u) ?? 0) + 1);
  }
  let best: UniverseKey | null = null;
  let bestCount = 0;
  for (const [u, c] of counts) {
    if (c > bestCount) { best = u; bestCount = c; }
  }
  return best ?? inferUniverseKeyFromText(gallery);
}

function inferUniverseKey(gallery: PublicGallery): UniverseKey {
  return gallery.universeKey;
}

function rowToGallery(row: Record<string, unknown>): PublicGallery {
  const layout = row.layout && typeof row.layout === "object" ? (row.layout as Record<string, unknown>) : null;
  const rawItemIds = Array.isArray(layout?.itemIds) ? layout!.itemIds : [];
  const itemIds = rawItemIds.filter((id): id is string => typeof id === "string");
  const themePack = typeof layout?.themePack === "string" ? layout.themePack : null;
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    description: typeof row.description === "string" ? row.description : null,
    cover_image: typeof row.cover_image === "string" && row.cover_image ? row.cover_image : null,
    profile_id: String(row.profile_id ?? ""),
    analytics_views: typeof row.analytics_views === "number" ? row.analytics_views : 0,
    item_count: itemIds.length,
    theme_pack: themePack,
    layout,
    itemIds,
    universeKey: "MISC", // overwritten in fetchData once real item universes are known
  };
}


// ─── Market Pulse: category risers/droppers based on gallery view momentum ───


type CategoryPulse = {
  category: UniverseKey;
  thumbnail: string;
  totalViews: number;
  galleryCount: number;
  topTitle: string;
  trend: "up" | "neutral";
};

function MarketPulse({ galleries, onSelectCategory }: { galleries: PublicGallery[]; onSelectCategory: (key: UniverseKey) => void }) {
  const pulseData = useMemo((): CategoryPulse[] => {
    const map = new Map<string, { views: number; count: number; topViews: number; topTitle: string }>();
    for (const g of galleries) {
      const cat = inferUniverseKey(g);
      const existing = map.get(cat) ?? { views: 0, count: 0, topViews: 0, topTitle: "" };
      map.set(cat, {
        views: existing.views + g.analytics_views,
        count: existing.count + 1,
        topViews: g.analytics_views > existing.topViews ? g.analytics_views : existing.topViews,
        topTitle: g.analytics_views > existing.topViews ? g.title : existing.topTitle,
      });
    }
    return Array.from(map.entries())
      .map(([category, data]) => ({
        category: category as UniverseKey,
        thumbnail: UNIVERSE_THUMB[category as UniverseKey] ?? "/universe-thumbnails/misc.png",
        totalViews: data.views,
        galleryCount: data.count,
        topTitle: data.topTitle,
        trend: data.views > 100 ? "up" as const : "neutral" as const,
      }))
      // No cap beyond the universe count itself (UNIVERSE_KEYS.length) - previously
      // capped at 6, which silently dropped any category that has galleries but
      // ranks below the 6 most-viewed, even though it's a real, valid category.
      .sort((a, b) => b.totalViews - a.totalViews)
      .slice(0, UNIVERSE_KEYS.length);
  }, [galleries]);

  if (pulseData.length < 2) return null;

  const maxViews = pulseData[0]?.totalViews ?? 1;

  return (
    <section className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[11px] tracking-[0.22em]" style={{ color: "var(--theme-text-muted, #A0956B)" }}>
          <Glyph name="chart" size={13} className="mr-1.5 inline align-[-1px]" />MARKET PULSE
        </div>
        <span className="text-[10px]" style={{ color: "var(--theme-text-muted, #A0956B)" }}>
          by gallery activity
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {pulseData.map((item, i) => {
          const barPct = Math.max(8, Math.round((item.totalViews / maxViews) * 100));
          const isTop = i === 0;
          return (
            <button key={item.category}
              type="button"
              onClick={() => onSelectCategory(item.category)}
              className="flex flex-col gap-2 rounded-[14px] px-3 py-3 text-left ring-1 transition hover:ring-[color:var(--theme-gold)]"
              style={{
                background: isTop ? "rgba(245,181,72,0.08)" : "var(--theme-elevated, rgba(20,32,55,0.9))",
                borderColor: isTop ? "rgba(245,181,72,0.35)" : "var(--theme-border, rgba(245,181,72,0.12))",
                cursor: "pointer",
              }}>
              <div className="flex items-start justify-between gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.thumbnail} alt={UNIVERSE_LABEL[item.category]} className="h-9 w-9 rounded-lg object-cover ring-1 ring-white/10" />
                {isTop && (
                  <span className="rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.15em]"
                    style={{ background: "rgba(245,181,72,0.2)", color: "#F5B548" }}>
                    HOT
                  </span>
                )}
              </div>
              <div>
                <div className="text-xs font-bold" style={{ color: isTop ? "#F5B548" : "var(--theme-text-primary, #F0EAD6)" }}>
                  {UNIVERSE_LABEL[item.category]}
                </div>
                <div className="mt-0.5 text-[10px]" style={{ color: "var(--theme-text-muted, #A0956B)" }}>
                  {item.galleryCount} {item.galleryCount !== 1 ? "galleries" : "gallery"}
                </div>
              </div>
              {/* Bar */}
              <div className="relative h-1 w-full overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
                <div className="absolute left-0 top-0 h-full rounded-full transition-all"
                  style={{ width: `${barPct}%`, background: isTop ? "#F5B548" : "rgba(245,181,72,0.35)" }} />
              </div>
              <div className="text-[10px] tabular-nums" style={{ color: "var(--theme-text-muted, #A0956B)" }}>
                {item.totalViews.toLocaleString()} views
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function DiscoverPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"All" | UniverseKey>("All");
  const [galleries, setGalleries] = useState<PublicGallery[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [swipeOpen, setSwipeOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [userPrefs, setUserPrefs] = useState<ReturnType<typeof buildUserPreferences> | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [focusedUniverses, setFocusedUniverses] = useState<UniverseKey[]>([]);

  // Drives the "Create a public gallery" CTA below - only relevant to logged-out
  // visitors, since a signed-in collector already has a vault and can create one
  // from inside the app.
  useEffect(() => {
    let active = true;
    async function loadUser() {
      const { data } = await getCurrentUser();
      if (!active) return;
      setSignedIn(Boolean(data.user));
      if (data.user) {
        // Load focused_universes to default the active tab
        try {
          const status = await getOnboardingStatus();
          const fu = (status.activeProfile as Record<string, unknown> | null)?.focused_universes;
          if (Array.isArray(fu) && fu.length > 0) {
            const validKeys = (fu as string[]).filter(isUniverseKey) as UniverseKey[];
            if (validKeys.length > 0) {
              setFocusedUniverses(validKeys);
              setActiveTab(validKeys[0]);
            }
          }
        } catch { /* non-critical */ }
      }
    }
    void loadUser();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    async function fetchData() {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) { setLoading(false); return; }
      try {
        const { data, error } = await supabase
          .from("galleries")
          .select("id, title, description, cover_image, profile_id, analytics_views, layout")
          .eq("visibility", "PUBLIC")
          .eq("state", "ACTIVE")
          .order("analytics_views", { ascending: false })
          .limit(100);

        if (error) {
          setFetchError(error.message);
          setLoading(false);
          return;
        }

        const mapped = (data ?? []).map((r) => rowToGallery(r as Record<string, unknown>));

        // Classify each gallery by its actual item universes instead of guessing
        // from title/description text - fixes both miscategorized galleries
        // dumped into Misc, and universes with real galleries never showing up
        // in Market Pulse because their titles happened not to match any keyword.
        const allItemIds = [...new Set(mapped.flatMap((g) => g.itemIds))];
        if (allItemIds.length > 0) {
          const { data: itemRows } = await supabase
            .from("vault_items")
            .select("id, universe")
            .in("id", allItemIds);
          const itemUniverseMap = new Map<string, UniverseKey>();
          for (const row of itemRows ?? []) {
            const universe = String((row as Record<string, unknown>).universe ?? "").toUpperCase();
            if (isUniverseKey(universe)) {
              itemUniverseMap.set(String((row as Record<string, unknown>).id), universe);
            }
          }
          for (const gallery of mapped) {
            gallery.universeKey = computeGalleryUniverse(gallery.itemIds, itemUniverseMap, gallery);
          }
        } else {
          for (const gallery of mapped) {
            gallery.universeKey = inferUniverseKeyFromText(gallery);
          }
        }

        const profileIds = [...new Set(mapped.map((g) => g.profile_id).filter(Boolean))];

        if (profileIds.length > 0) {
          const { data: profiles } = await supabase
            .from("public_profiles")
            .select("profile_id, display_name, avatar_emoji, avatar_url")
            .in("profile_id", profileIds);
          const profileMap = new Map((profiles ?? []).map((p) => [
            String(p.profile_id),
            { name: String(p.display_name || "Collector"), avatar: String(p.avatar_emoji || "🗝️") },
          ]));
          const profileAvatarUrlMap = new Map((profiles ?? []).map((p) => [
            String(p.profile_id),
            typeof p.avatar_url === "string" && isRenderableAvatarUrl(p.avatar_url)
              ? p.avatar_url
              : getSeedAvatarUrlForProfile({
                profileId: String(p.profile_id),
                displayName: String(p.display_name || ""),
              }),
          ]));
          setGalleries(mapped.map((g) => ({
            ...g,
            collector_name: profileMap.get(g.profile_id)?.name ?? "Collector",
            collector_avatar_url: profileAvatarUrlMap.get(g.profile_id) ?? "",
            collector_avatar: profileMap.get(g.profile_id)?.avatar ?? "🗝️",
          })));
        } else {
          setGalleries(mapped);
        }

        // Build personalization preferences from vault + watchlist (non-critical)
        try {
          const vaultItems = loadItems();
          const watchlistItems = loadWatchlist();
          const prefs = buildUserPreferences(vaultItems, watchlistItems);
          if (prefs.hasPreferences) setUserPrefs(prefs);
        } catch { /* personalization is optional */ }
      } catch (e) {
        setFetchError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    void fetchData();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = galleries.filter((g) => {
      const category = inferUniverseKey(g);
      const matchesTab = activeTab === "All" || category === activeTab;
      const matchesQuery = !q ||
        (g.title ?? "").toLowerCase().includes(q) ||
        (g.description ?? "").toLowerCase().includes(q) ||
        (g.collector_name ?? "").toLowerCase().includes(q) ||
        category.toLowerCase().includes(q);
      return matchesTab && matchesQuery;
    });
    // Apply personalization re-ranking on the "All" tab with no search query
    if (userPrefs && activeTab === "All" && !q) {
      return sortByPersonalization(base, userPrefs, inferUniverseKey);
    }
    return base;
  }, [galleries, activeTab, query, userPrefs]);

  const isEmpty = !loading && filtered.length === 0;
  const hasActiveFilter = activeTab !== "All" || query.trim() !== "";

  // Trending = top 3 by views (only when on "All" tab, no search query)
  const trendingGalleries = useMemo(() =>
    activeTab === "All" && !query.trim()
      ? [...galleries].sort((a, b) => b.analytics_views - a.analytics_views).slice(0, 3)
      : [],
    [galleries, activeTab, query]
  );

  // Stats
  const totalViews = useMemo(() => galleries.reduce((sum, g) => sum + g.analytics_views, 0), [galleries]);
  const uniqueCollectors = useMemo(() => new Set(galleries.map((g) => g.profile_id)).size, [galleries]);
  const selectedGallery = useMemo(
    () => filtered.find((g) => g.id === selectedId) ?? filtered[0] ?? galleries[0] ?? null,
    [filtered, galleries, selectedId]
  );

  function coverStyle(gallery: PublicGallery) {
    if (gallery.cover_image) return { background: `url(${gallery.cover_image}) center/cover no-repeat` };
    return { background: "linear-gradient(135deg, rgba(245,181,72,0.15), rgba(20,32,55,0.9))" };
  }

  return (
    <main className="text-[color:var(--fg)]">
      <div className="mx-auto max-w-[1480px] px-4 py-7 sm:px-6 lg:px-8">

        {/* Header */}
        <section className="relative overflow-hidden rounded-[20px] px-5 py-4" style={{ background: "var(--theme-card, rgba(15,25,45,0.85))", border: "1px solid var(--theme-border, rgba(245,181,72,0.12))" }}>
          <div className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full" style={{ background: "radial-gradient(circle, rgba(245,181,72,0.10) 0%, transparent 70%)", filter: "blur(30px)" }} />
          <div className="relative">
            <div className="text-[11px] tracking-[0.22em]" style={{ color: "var(--theme-text-muted, #A0956B)" }}>DISCOVER</div>
            <div className="mt-1 flex items-center justify-between gap-3">
              <h1 className="text-3xl font-black tracking-[-0.04em]" style={{ color: "var(--theme-text-primary, #F0EAD6)" }}>Explore Galleries</h1>
              <button
                onClick={() => setSwipeOpen(true)}
                className="flex min-h-[44px] items-center gap-1.5 rounded-full px-4 text-sm font-black transition hover:brightness-110 active:scale-95"
                style={{ background: "linear-gradient(135deg, #8B6914 0%, #C8941F 30%, #F5B548 60%, #C8941F 100%)", color: "#0B0B0B" }}
              >
                <Glyph name="cards" size={16} className="mr-1.5 inline align-[-2px]" />The Flip
              </button>
            </div>
            <p className="mt-1 max-w-xl text-sm leading-6" style={{ color: "var(--theme-text-muted, #A0956B)" }}>
              Browse public galleries from collectors across every universe. Filter by category or search by name.
            </p>
            <div className="mt-4 flex max-w-md items-center gap-2 rounded-2xl px-4" style={{ background: "var(--theme-elevated, rgba(20,32,55,0.9))", border: "1px solid var(--theme-border, rgba(245,181,72,0.14))" }}>
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 opacity-50" fill="none">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                <path d="m16.5 16.5 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search galleries or collectors…" className="flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:opacity-40" style={{ color: "var(--theme-text-primary, #F0EAD6)" }} />
              {query && <button type="button" onClick={() => setQuery("")} className="text-xs opacity-50 hover:opacity-100">✕</button>}
            </div>
            {fetchError && (
              <div className="mt-3 rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-300">Query error: {fetchError}</div>
            )}
          </div>
        </section>

        {/* Stats bar */}
        {!loading && galleries.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 px-1 text-[11px]" style={{ color: "var(--theme-text-muted, #A0956B)" }}>
            <span><span className="font-bold" style={{ color: "var(--theme-text-primary, #F0EAD6)" }}>{galleries.length}</span> galleries</span>
            <span><span className="font-bold" style={{ color: "var(--theme-text-primary, #F0EAD6)" }}>{uniqueCollectors}</span> collectors</span>
            {totalViews > 0 && <span><span className="font-bold" style={{ color: "var(--theme-text-primary, #F0EAD6)" }}>{totalViews.toLocaleString()}</span> total views</span>}
            <Link href="/community-board" className="ml-auto font-semibold hover:underline" style={{ color: "var(--theme-gold, #F5B548)" }}>
              VLT Lounge →
            </Link>
          </div>
        )}

        {/* VLT Lounge + Marketplace quick-access cards */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Link
            href="/community-board"
            className="group flex flex-col gap-2 rounded-[16px] px-4 py-4 transition hover:-translate-y-0.5 hover:brightness-110"
            style={{ background: "var(--theme-elevated, rgba(20,32,55,0.9))", border: "1px solid var(--theme-border, rgba(245,181,72,0.14))" }}
          >
            <div style={{ color: "var(--theme-gold, #F5B548)" }}><Glyph name="sofa" size={26} /></div>
            <div>
              <div className="text-sm font-black" style={{ color: "var(--theme-text-primary, #F0EAD6)" }}>VLT Lounge</div>
              <div className="mt-0.5 text-[11px]" style={{ color: "var(--theme-text-muted, #A0956B)" }}>
                Spotlights, MVPs &amp; collector community
              </div>
            </div>
            <div className="mt-auto text-[11px] font-semibold" style={{ color: "var(--theme-gold, #F5B548)" }}>
              Visit VLT Lounge →
            </div>
          </Link>
          <Link
            href="/market"
            className="group flex flex-col gap-2 rounded-[16px] px-4 py-4 transition hover:-translate-y-0.5 hover:brightness-110"
            style={{ background: "var(--theme-elevated, rgba(20,32,55,0.9))", border: "1px solid var(--theme-border, rgba(245,181,72,0.14))" }}
          >
            <div style={{ color: "var(--theme-gold, #F5B548)" }}><Glyph name="cart" size={26} /></div>
            <div>
              <div className="text-sm font-black" style={{ color: "var(--theme-text-primary, #F0EAD6)" }}>Marketplace</div>
              <div className="mt-0.5 text-[11px]" style={{ color: "var(--theme-text-muted, #A0956B)" }}>
                Browse items for sale from collectors
              </div>
            </div>
            <div className="mt-auto text-[11px] font-semibold" style={{ color: "var(--theme-gold, #F5B548)" }}>
              Browse listings →
            </div>
          </Link>
        </div>

        {/* Tab bar */}
        <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {TABS.map((tab) => (
            <button key={tab} type="button" onClick={() => { setActiveTab(tab); if (tab !== "All") setFocusedUniverses([]); }}
              className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition"
              style={activeTab === tab
                ? { background: "linear-gradient(135deg, #8B6914, #F5B548)", color: "#0B0B0B", border: "1px solid transparent" }
                : { background: "var(--theme-elevated, rgba(20,32,55,0.9))", color: "var(--theme-text-muted, #A0956B)", border: "1px solid var(--theme-border, rgba(245,181,72,0.12))" }
              }
            >{tab === "All" ? "All" : UNIVERSE_LABEL[tab]}</button>
          ))}
        </div>

        {/* Focused universe note */}
        {focusedUniverses.length > 0 && activeTab !== "All" && (
          <div className="mt-2 flex items-center gap-1.5 text-[11px]" style={{ color: "var(--theme-text-muted, #A0956B)" }}>
            <span>Showing your focused universes</span>
            <span>·</span>
            <button
              type="button"
              onClick={() => { setActiveTab("All"); setFocusedUniverses([]); }}
              className="font-semibold hover:underline"
              style={{ color: "var(--theme-gold, #F5B548)" }}
            >
              Show all
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[1,2,3,4,5,6].map((i) => <div key={i} className="h-[200px] animate-pulse rounded-[18px]" style={{ background: "var(--surface)" }} />)}
          </div>
        )}

        {/* Empty */}
        {isEmpty && (
          <section className="mt-6 rounded-[20px] p-10 text-center" style={{ background: "var(--theme-card, rgba(15,25,45,0.85))", border: "1px solid var(--theme-border, rgba(245,181,72,0.12))" }}>
            <div className="flex justify-center" style={{ color: "var(--theme-gold)" }}><Glyph name="search" size={34} /></div>
            <h2 className="mt-3 text-lg font-black" style={{ color: "var(--theme-text-primary, #F0EAD6)" }}>No galleries match</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--theme-text-muted, #A0956B)" }}>
              {hasActiveFilter ? `No results for${activeTab !== "All" ? ` "${UNIVERSE_LABEL[activeTab]}"` : ""}${query ? ` "${query}"` : ""}.` : "No public galleries yet. Be the first!"}
            </p>
            {hasActiveFilter && (
              <button type="button" onClick={() => { setActiveTab("All"); setQuery(""); }}
                className="mt-4 rounded-full px-4 py-2 text-sm font-semibold transition hover:brightness-110"
                style={{ background: "linear-gradient(135deg, #8B6914, #F5B548)", color: "#0B0B0B" }}>
                Show All
              </button>
            )}
          </section>
        )}

        {/* Trending row — top 3 by views */}
        {!loading && trendingGalleries.length > 0 && (
          <section className="mt-6">
            <div className="mb-3 flex items-center gap-2">
              <div className="text-[11px] tracking-[0.22em]" style={{ color: "var(--theme-text-muted, #A0956B)" }}><Glyph name="flame" size={13} className="mr-1.5 inline align-[-1px]" />TRENDING</div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {trendingGalleries.map((gallery, rank) => (
                <div key={gallery.id}
                  className="group relative overflow-hidden rounded-[18px] cursor-pointer transition hover:-translate-y-0.5"
                  style={{ background: "var(--surface)", border: "1px solid rgba(245,181,72,0.22)" }}
                  onClick={() => setSelectedId(gallery.id)}
                  onDoubleClick={() => router.push(`/museum/${gallery.id}/guest`)}>
                  <div className="relative h-[140px] overflow-hidden rounded-t-[18px]" style={coverStyle(gallery)}>
                    <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-transparent to-transparent" />
                    <div className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-sm font-black"
                      style={{ background: rank === 0 ? "#F5B548" : rank === 1 ? "rgba(192,192,192,0.9)" : "rgba(150,100,50,0.9)", color: "#0B0B0B" }}>
                      {rank + 1}
                    </div>
                    {gallery.analytics_views > 0 && (
                      <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{ background: "rgba(0,0,0,0.55)", color: "rgba(255,255,255,0.75)" }}>
                        <Glyph name="eye" size={12} className="inline align-[-1px]" /> {gallery.analytics_views.toLocaleString()}
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="truncate text-sm font-black" style={{ color: "var(--theme-gold, #F5B548)" }}>{gallery.title}</div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="text-[10px]" style={{ color: "var(--muted2)" }}>{gallery.item_count > 0 ? `${gallery.item_count} items` : UNIVERSE_LABEL[inferUniverseKey(gallery)]}</span>
                      {gallery.collector_name && (
                        <Link href={`/v/${gallery.profile_id}`}
                          className="flex items-center gap-1 text-[10px] hover:underline z-10 relative"
                          style={{ color: "rgba(255,255,255,0.5)" }}
                          onClick={(e) => e.stopPropagation()}>
                          {gallery.collector_avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={gallery.collector_avatar_url} alt="" className="h-5 w-5 rounded-full object-cover ring-1 ring-white/15" />
                          ) : (
                            <span>{gallery.collector_avatar}</span>
                          )}
                          <span className="max-w-[80px] truncate">{gallery.collector_name}</span>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Market Pulse widget — category activity heatmap */}
        {!loading && galleries.length > 3 && activeTab === "All" && !query.trim() && (
          <MarketPulse galleries={galleries} onSelectCategory={setActiveTab} />
        )}

        {/* All Galleries grid — no cap */}
        {!loading && filtered.length > 0 && (
          <section className="mt-6">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <div className="text-[11px] tracking-[0.22em]" style={{ color: "var(--theme-text-muted, #A0956B)" }}>
                {activeTab === "All" ? "ALL GALLERIES" : `${UNIVERSE_LABEL[activeTab].toUpperCase()} GALLERIES`}
              </div>
              <span className="text-xs" style={{ color: "var(--theme-text-muted, #A0956B)" }}>{filtered.length} shown</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((gallery) => (
                <div key={gallery.id}
                  className="group relative overflow-hidden rounded-[18px] transition hover:-translate-y-0.5 cursor-pointer"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                  onClick={() => setSelectedId(gallery.id)}
                  onDoubleClick={() => router.push(`/museum/${gallery.id}/guest`)}>
                  <div className="relative h-[130px] overflow-hidden rounded-t-[18px]" style={coverStyle(gallery)}>
                    <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-transparent to-transparent" />
                    <span className="absolute left-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
                      style={{ background: "rgba(245,181,72,0.18)", color: "#F5B548", border: "1px solid rgba(245,181,72,0.28)" }}>
                      {UNIVERSE_LABEL[inferUniverseKey(gallery)]}
                    </span>
                  </div>
                  <div className="p-4">
                    <div className="text-sm font-black" style={{ color: "var(--theme-gold, #F5B548)" }}>{gallery.title}</div>
                    {gallery.description && (
                      <div className="mt-1 line-clamp-2 text-xs leading-5" style={{ color: "var(--muted)" }}>{gallery.description}</div>
                    )}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--muted2)" }}>
                        <span>{gallery.item_count > 0 ? `${gallery.item_count} items` : "New"}</span>
                        {gallery.analytics_views > 0 && (
                          <span className="flex items-center gap-0.5 normal-case tracking-normal">
                            <span><Glyph name="eye" size={11} /></span>
                            <span>{gallery.analytics_views.toLocaleString()}</span>
                          </span>
                        )}
                      </div>
                      {gallery.collector_name && (
                        <Link href={`/v/${gallery.profile_id}`}
                          className="flex items-center gap-1 text-[10px] hover:underline z-10 relative"
                          style={{ color: "var(--theme-gold, #F5B548)" }}
                          onClick={(e) => e.stopPropagation()}>
                          {gallery.collector_avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={gallery.collector_avatar_url} alt="" className="h-5 w-5 rounded-full object-cover ring-1 ring-white/15" />
                          ) : (
                            <span>{gallery.collector_avatar}</span>
                          )}
                          <span className="max-w-[90px] truncate">{gallery.collector_name}</span>
                        </Link>
                      )}
                    </div>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center rounded-[18px] opacity-0 transition group-hover:opacity-100 pointer-events-none" style={{ background: "rgba(0,0,0,0.55)" }}>
                    <button type="button" onClick={(e) => { e.stopPropagation(); router.push(`/museum/${gallery.id}/guest`); }} className="rounded-[7px] px-4 py-2 text-xs font-bold" style={{ background: "var(--theme-gold, #F5B548)", color: "#0B0B0B" }}>View Gallery</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {selectedGallery && (
          <section className="mt-6 rounded-[8px] border border-[rgba(245,181,72,0.22)] bg-[color:var(--theme-card,rgba(15,25,45,0.85))] p-4 xl:fixed xl:right-8 xl:top-[92px] xl:mt-0 xl:w-[360px] xl:max-w-[calc(100vw-32px)]">
            <div className="text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: "var(--theme-text-muted, #A0956B)" }}>Public Exhibition</div>
            <div className="mt-3 h-44 rounded-[7px] border border-[rgba(245,181,72,0.22)]" style={coverStyle(selectedGallery)} />
            <h2 className="mt-4 text-xl font-black text-[color:var(--theme-text-primary,#F0EAD6)]">{selectedGallery.title}</h2>
            <div className="mt-1 flex flex-wrap gap-2 text-[12px]" style={{ color: "var(--theme-text-muted, #A0956B)" }}>
              <span>{selectedGallery.item_count || 0} items</span>
              <span>{UNIVERSE_LABEL[inferUniverseKey(selectedGallery)]}</span>
              <span>{selectedGallery.analytics_views.toLocaleString()} views</span>
            </div>
            {selectedGallery.description && (
              <p className="mt-3 line-clamp-3 text-sm leading-6" style={{ color: "var(--theme-text-muted, #A0956B)" }}>{selectedGallery.description}</p>
            )}
            <div className="mt-4 flex items-center gap-2 rounded-[7px] border border-[rgba(245,181,72,0.14)] bg-black/10 p-2">
              {selectedGallery.collector_avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selectedGallery.collector_avatar_url} alt="" className="h-9 w-9 rounded-full object-cover ring-1 ring-white/15" />
              ) : (
                <span className="grid h-9 w-9 place-items-center rounded-full bg-[rgba(245,181,72,0.10)]">{selectedGallery.collector_avatar}</span>
              )}
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-[color:var(--theme-text-primary,#F0EAD6)]">{selectedGallery.collector_name ?? "Collector"}</div>
                <Link href={`/v/${selectedGallery.profile_id}`} className="text-[11px] font-semibold" style={{ color: "var(--theme-gold,#F5B548)" }}>View collector</Link>
              </div>
            </div>
            <Link href={`/museum/${selectedGallery.id}/guest`} className="mt-4 flex h-10 items-center justify-center rounded-[7px] text-sm font-black" style={{ background: "linear-gradient(135deg, #8B6914, #F5B548)", color: "#0B0B0B" }}>
              Open exhibition
            </Link>
          </section>
        )}

        {/* CTA — logged-out visitors only; a signed-in collector already has a
            vault and can create a gallery from inside the app. */}
        {!loading && !signedIn && (
          <section className="mt-10 flex flex-col items-center gap-3 rounded-[20px] px-6 py-8 text-center"
            style={{ background: "var(--theme-card, rgba(15,25,45,0.85))", border: "1px solid var(--theme-border, rgba(245,181,72,0.12))" }}>
            <div className="text-[11px] tracking-[0.22em]" style={{ color: "var(--theme-text-muted, #A0956B)" }}>BUILD YOUR OWN</div>
            <h2 className="text-xl font-black" style={{ color: "var(--theme-text-primary, #F0EAD6)" }}>Create a public gallery</h2>
            <p className="max-w-sm text-sm leading-6" style={{ color: "var(--theme-text-muted, #A0956B)" }}>
              Vault your collection, curate a gallery, and share it with one link.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/museum/new" className="rounded-full px-5 py-2 text-sm font-black transition hover:brightness-105"
                style={{ background: "linear-gradient(135deg, #8B6914 0%, #C8941F 30%, #F5B548 60%, #C8941F 100%)", color: "#0B0B0B" }}>
                Create Gallery
              </Link>
              <Link href="/vault" className="rounded-full border px-5 py-2 text-sm font-semibold transition hover:brightness-110"
                style={{ borderColor: "rgba(245,181,72,0.28)", color: "#F5B548", background: "rgba(245,181,72,0.06)" }}>
                Go to Vault →
              </Link>
            </div>
          </section>
        )}

      </div>
      <DiscoverSwipe open={swipeOpen} onClose={() => setSwipeOpen(false)} />
    </main>
  );
}
