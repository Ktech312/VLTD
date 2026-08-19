"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import DiscoverSwipe from "@/components/DiscoverSwipe";
import { PageHeader } from "@/components/layout/PageHeader";
import { Glyph } from "@/components/ui/Glyph";
import { getCurrentUser, getOnboardingStatus } from "@/lib/auth";
import { buildUserPreferences, sortByPersonalization } from "@/lib/personalization";
import { getSeedAvatarUrlForProfile, isRenderableAvatarUrl } from "@/lib/seedAvatar";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { showToast } from "@/lib/toast";
import { isUniverseKey, type UniverseKey, UNIVERSE_KEYS, UNIVERSE_LABEL } from "@/lib/taxonomy";
import { loadItems } from "@/lib/vaultModel";
import { loadWatchlist } from "@/lib/watchlistModel";

const UNIVERSE_THUMB: Record<UniverseKey, string> = {
  POP_CULTURE: "/universe-thumbnails/pop-culture.png",
  SPORTS: "/universe-thumbnails/sports.png",
  TCG: "/universe-thumbnails/tcg.png",
  MUSIC: "/universe-thumbnails/music.png",
  JEWELRY_APPAREL: "/universe-thumbnails/jewelry-apparel.png",
  GAMES: "/universe-thumbnails/games.png",
  BUILT_BOTANY: "/universe-thumbnails/built-botany.png",
  MISC: "/universe-thumbnails/misc.png",
  AUTOMOTIVE: "/universe-thumbnails/automotive.png",
  ART: "/universe-thumbnails/art.png",
};

type GalleryItemFact = { value: number; imageUrl: string | null; title: string };

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
  universeKey: UniverseKey;
  created_at?: string | null;
  collector_name?: string;
  collector_avatar_url?: string;
};

function normalizeForSearch(value: unknown) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function inferUniverseKeyFromText(gallery: Pick<PublicGallery, "title" | "description" | "theme_pack">): UniverseKey {
  const text = normalizeForSearch([gallery.title, gallery.description, gallery.theme_pack].filter(Boolean).join(" "));
  const includes = (...terms: string[]) => terms.some((term) => text.includes(term));
  if (includes("pokemon", "magic", "tcg", "trading card", "card game", "slab", "foil")) return "TCG";
  if (includes("sports", "rookie", "jersey", "autograph", "baseball", "basketball", "football", "soccer", "hockey")) return "SPORTS";
  if (includes("vinyl", "album", "music", "record", "instrument", "guitar", "piano")) return "MUSIC";
  if (includes("watch", "jewelry", "apparel", "streetwear", "luxury", "handbag")) return "JEWELRY_APPAREL";
  if (includes("game", "console", "nintendo", "playstation", "xbox", "sega", "arcade")) return "GAMES";
  if (includes("comic", "marvel", "figure", "toy", "manga", "funko", "prop", "statue")) return "POP_CULTURE";
  if (includes("handmade", "ceramic", "woodwork", "plant", "botany", "garden")) return "BUILT_BOTANY";
  if (includes("car", "automotive", "vehicle", "garage")) return "AUTOMOTIVE";
  if (includes("art", "painting", "poster", "print")) return "ART";
  return "MISC";
}

function rowToGallery(row: Record<string, unknown>): PublicGallery {
  const layout = row.layout && typeof row.layout === "object" ? (row.layout as Record<string, unknown>) : null;
  const rawItemIds = Array.isArray(layout?.itemIds) ? layout.itemIds : [];
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
    universeKey: "MISC",
    created_at: typeof row.created_at === "string" ? row.created_at : null,
  };
}

function computeGalleryUniverse(itemIds: string[], itemUniverseMap: Map<string, UniverseKey>, gallery: PublicGallery): UniverseKey {
  const counts = new Map<UniverseKey, number>();
  for (const id of itemIds) {
    const universe = itemUniverseMap.get(id);
    if (universe) counts.set(universe, (counts.get(universe) ?? 0) + 1);
  }

  let best: UniverseKey | null = null;
  let bestCount = 0;
  for (const [universe, count] of counts) {
    if (count > bestCount) {
      best = universe;
      bestCount = count;
    }
  }
  return best ?? inferUniverseKeyFromText(gallery);
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
  const [sort, setSort] = useState<"recommended" | "views" | "items" | "newest" | "az">("recommended");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [reporting, setReporting] = useState(false);
  const [itemFactsById, setItemFactsById] = useState<Map<string, GalleryItemFact>>(new Map());
  const [userPrefs, setUserPrefs] = useState<ReturnType<typeof buildUserPreferences> | null>(null);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadUser() {
      const { data } = await getCurrentUser();
      if (!active) return;
      setSignedIn(Boolean(data.user));

      if (data.user) {
        try {
          const status = await getOnboardingStatus();
          const focused = (status.activeProfile as Record<string, unknown> | null)?.focused_universes;
          if (Array.isArray(focused)) {
            const first = focused.find((key): key is UniverseKey => typeof key === "string" && isUniverseKey(key));
            if (first) setActiveTab(first);
          }
        } catch {
          // Non-critical personalization hint.
        }
      }
    }

    void loadUser();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    async function fetchData() {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("galleries")
          .select("id, title, description, cover_image, profile_id, analytics_views, layout, created_at")
          .eq("visibility", "PUBLIC")
          .eq("state", "ACTIVE")
          .order("analytics_views", { ascending: false })
          .limit(100);

        if (error) {
          setFetchError(error.message);
          setLoading(false);
          return;
        }

        const mapped = (data ?? []).map((row) => rowToGallery(row as Record<string, unknown>));
        const allItemIds = [...new Set(mapped.flatMap((gallery) => gallery.itemIds))];

        if (allItemIds.length > 0) {
          // Pull value + image too, so gallery value and featured items are the
          // real items rather than invented numbers and a repeated cover.
          const { data: itemRows } = await supabase
            .from("vault_items")
            .select("id, universe, current_value, image_front_url, title")
            .in("id", allItemIds);
          const itemUniverseMap = new Map<string, UniverseKey>();
          const itemFacts = new Map<string, GalleryItemFact>();
          for (const raw of itemRows ?? []) {
            const row = raw as Record<string, unknown>;
            const id = String(row.id);
            const universe = String(row.universe ?? "").toUpperCase();
            if (isUniverseKey(universe)) itemUniverseMap.set(id, universe);
            itemFacts.set(id, {
              value: Number(row.current_value ?? 0) || 0,
              imageUrl: typeof row.image_front_url === "string" ? row.image_front_url : null,
              title: String(row.title ?? ""),
            });
          }
          setItemFactsById(itemFacts);
          for (const gallery of mapped) gallery.universeKey = computeGalleryUniverse(gallery.itemIds, itemUniverseMap, gallery);
        } else {
          for (const gallery of mapped) gallery.universeKey = inferUniverseKeyFromText(gallery);
        }

        const profileIds = [...new Set(mapped.map((gallery) => gallery.profile_id).filter(Boolean))];
        if (profileIds.length > 0) {
          const { data: profiles } = await supabase
            .from("public_profiles")
            .select("profile_id, display_name, avatar_url")
            .in("profile_id", profileIds);

          const profileMap = new Map((profiles ?? []).map((profile) => [
            String(profile.profile_id),
            {
              name: String(profile.display_name || "Collector"),
              avatarUrl: typeof profile.avatar_url === "string" && isRenderableAvatarUrl(profile.avatar_url)
                ? profile.avatar_url
                : getSeedAvatarUrlForProfile({
                  profileId: String(profile.profile_id),
                  displayName: String(profile.display_name || ""),
                }),
            },
          ]));

          setGalleries(mapped.map((gallery) => ({
            ...gallery,
            collector_name: profileMap.get(gallery.profile_id)?.name ?? "Collector",
            collector_avatar_url: profileMap.get(gallery.profile_id)?.avatarUrl ?? "",
          })));
        } else {
          setGalleries(mapped);
        }

        try {
          const prefs = buildUserPreferences(loadItems(), loadWatchlist());
          if (prefs.hasPreferences) setUserPrefs(prefs);
        } catch {
          // Personalization is optional.
        }
      } catch (error) {
        setFetchError(error instanceof Error ? error.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    void fetchData();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = galleries.filter((gallery) => {
      const category = gallery.universeKey;
      const matchesTab = activeTab === "All" || category === activeTab;
      const matchesQuery = !q ||
        gallery.title.toLowerCase().includes(q) ||
        (gallery.description ?? "").toLowerCase().includes(q) ||
        (gallery.collector_name ?? "").toLowerCase().includes(q) ||
        UNIVERSE_LABEL[category].toLowerCase().includes(q);

      return matchesTab && matchesQuery;
    });

    if (userPrefs && activeTab === "All" && !q) {
      return sortByPersonalization(base, userPrefs, (gallery) => gallery.universeKey);
    }

    return base;
  }, [activeTab, galleries, query, userPrefs]);

  const isEmpty = !loading && filtered.length === 0;
  const hasActiveFilter = activeTab !== "All" || query.trim() !== "";
  const galleryTime = (gallery: PublicGallery) => (gallery.created_at ? Date.parse(gallery.created_at) : 0);
  const displayGalleries = (() => {
    const base = filtered.length > 0 ? filtered : galleries;
    const list = [...base];
    if (sort === "views") list.sort((a, b) => (b.analytics_views ?? 0) - (a.analytics_views ?? 0));
    else if (sort === "items") list.sort((a, b) => (b.item_count ?? 0) - (a.item_count ?? 0));
    else if (sort === "az") list.sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === "newest") list.sort((a, b) => galleryTime(b) - galleryTime(a));
    return list;
  })();
  const selectedGallery = displayGalleries.find((gallery) => gallery.id === selectedId) ?? displayGalleries[0] ?? null;

  // Real groupings rather than arbitrary slices of the same list.
  const trending = [...displayGalleries].sort((a, b) => (b.analytics_views ?? 0) - (a.analytics_views ?? 0));
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const newThisWeek = displayGalleries.filter((gallery) => galleryTime(gallery) >= weekAgo);
  const notableItems = [...displayGalleries].sort((a, b) => (b.item_count ?? 0) - (a.item_count ?? 0));
  const shown = (list: PublicGallery[], key: string) => (expanded[key] ? list : list.slice(0, 4));
  const toggleSection = (key: string) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  async function shareGallery(gallery: PublicGallery) {
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/museum/${gallery.id}/guest`;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: gallery.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      showToast("Room link copied");
    } catch {
      showToast("Couldn't share that room.");
    }
  }

  // Content reports go to the same bug_reports inbox the admin already reads.
  async function reportGallery(gallery: PublicGallery) {
    if (reporting) return;
    const reason = typeof window !== "undefined" ? window.prompt(`Report "${gallery.title}" — what's wrong with this room?`) : null;
    if (!reason || !reason.trim()) return;
    setReporting(true);
    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) throw new Error("offline");
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("bug_reports").insert({
        user_id: userData?.user?.id ?? null,
        email: userData?.user?.email ?? null,
        message: `[CONTENT REPORT] Gallery "${gallery.title}" (${gallery.id}) — ${reason.trim().slice(0, 1500)}`,
        page_path: typeof window !== "undefined" ? window.location.pathname : null,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 400) : null,
      });
      if (error) throw error;
      showToast("Report sent. Thank you.");
    } catch {
      showToast("Couldn't send that report. Try again.");
    } finally {
      setReporting(false);
    }
  }
  const universeCounts = UNIVERSE_KEYS.map((key) => ({
    key,
    count: galleries.filter((gallery) => gallery.universeKey === key).length,
  })).filter((item) => item.count > 0).slice(0, 7);

  function coverStyle(gallery: PublicGallery) {
    if (gallery.cover_image) return { background: `url(${gallery.cover_image}) center/cover no-repeat` };
    return { background: `url(${UNIVERSE_THUMB[gallery.universeKey] ?? UNIVERSE_THUMB.MISC}) center/cover no-repeat` };
  }

  function galleryValue(gallery: PublicGallery) {
    // Real value: sum of what the items in this room are actually worth.
    // (This used to be views * 1250 + items * 700, which was invented and made
    // the same room read $58,300 here and $3,940 on Exhibitions.)
    return gallery.itemIds.reduce((sum, id) => sum + (itemFactsById.get(id)?.value ?? 0), 0);
  }

  function openGallery(gallery: PublicGallery) {
    router.push(`/museum/${gallery.id}/guest`);
  }

  function GalleryCard({ gallery, compact = false }: { gallery: PublicGallery; compact?: boolean }) {
    return (
      <button
        type="button"
        onClick={() => setSelectedId(gallery.id)}
        onDoubleClick={() => openGallery(gallery)}
        className="group overflow-hidden rounded-[7px] border text-left transition hover:-translate-y-0.5"
        style={{
          background: "var(--theme-card, rgba(15,25,45,0.85))",
          borderColor: selectedGallery?.id === gallery.id ? "#4FD3EE" : "rgba(203,208,213,0.22)",
        }}
      >
        {!compact && (
          <div className="relative h-[128px]" style={coverStyle(gallery)}>
            <div className="absolute inset-0 bg-gradient-to-t from-[#030809] via-black/20 to-transparent" />
            <span className="absolute left-3 top-3 rounded-[5px] border border-[rgba(203,208,213,0.28)] bg-black/50 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em]" style={{ color: "var(--theme-gold,#C8CDD2)" }}>
              {UNIVERSE_LABEL[gallery.universeKey]}
            </span>
          </div>
        )}
        <div className={compact ? "grid grid-cols-[72px_minmax(0,1fr)_auto] gap-3 p-3" : "p-3"}>
          {compact && <div className="-ml-3 -my-3 h-[92px] rounded-l-[7px]" style={coverStyle(gallery)} />}
          <div className="min-w-0">
            <div className="truncate font-serif text-[17px] font-black leading-tight" style={{ color: "var(--theme-text-primary,#ECEDEF)" }}>{gallery.title}</div>
            <div className="mt-0.5 truncate text-[11px]" style={{ color: "var(--theme-text-muted,#61656B)" }}>by {gallery.collector_name ?? "Collector"}</div>
            <div className="mt-1 flex flex-wrap gap-2 text-[11px]" style={{ color: "var(--theme-text-muted,#61656B)" }}>
              <span>{gallery.item_count || 0} items</span>
              <span>Public</span>
            </div>
            {!compact && <div className="mt-1 text-[14px] font-black text-[color:var(--info,#52D6F4)]">${galleryValue(gallery).toLocaleString()}</div>}
          </div>
          {compact && <div className="self-center text-[14px] font-black text-[color:var(--info,#52D6F4)]">${galleryValue(gallery).toLocaleString()}</div>}
        </div>
      </button>
    );
  }

  return (
    <>
      <PageHeader
        title="Discover"
        description={<span style={{ color: "var(--theme-text-muted,#61656B)" }}>Explore public collections, notable items, and collector rooms.</span>}
        contentClassName="max-w-[1480px]"
      />
      <main className="text-[color:var(--fg)]">
      <div className="mx-auto grid max-w-[1480px] gap-6 px-4 pb-6 sm:px-6 lg:px-8 xl:grid-cols-[minmax(0,1fr)_430px]">
        <div className="min-w-0">
          <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_200px_200px]">
            <label className="flex h-10 items-center gap-2 rounded-[7px] border border-[rgba(203,208,213,0.22)] px-3" style={{ background: "var(--theme-card,rgba(15,25,45,0.85))" }}>
              <Glyph name="search" size={15} className="opacity-60" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search exhibitions, items, and collectors..." className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:opacity-45" />
            </label>
            <select
              value={activeTab}
              onChange={(event) => setActiveTab(event.target.value === "All" ? "All" : (event.target.value as UniverseKey))}
              aria-label="Filter by universe"
              className="h-10 rounded-[7px] border border-[rgba(203,208,213,0.22)] px-3 text-xs font-semibold outline-none"
              style={{ background: "var(--theme-card,rgba(15,25,45,0.85))", color: "var(--theme-text-primary,#ECEDEF)" }}
            >
              <option value="All">All universes</option>
              {UNIVERSE_KEYS.map((key) => (
                <option key={key} value={key}>{UNIVERSE_LABEL[key]}</option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as typeof sort)}
              aria-label="Sort exhibitions"
              className="h-10 rounded-[7px] border border-[rgba(203,208,213,0.22)] px-3 text-xs font-semibold outline-none"
              style={{ background: "var(--theme-card,rgba(15,25,45,0.85))", color: "var(--theme-text-primary,#ECEDEF)" }}
            >
              <option value="recommended">Recommended</option>
              <option value="views">Most viewed</option>
              <option value="items">Most items</option>
              <option value="newest">Newest</option>
              <option value="az">A to Z</option>
            </select>
          </div>

          {fetchError && <div className="mt-3 rounded-[7px] border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">Query error: {fetchError}</div>}

          {selectedGallery && (
            <section className="mt-4 overflow-hidden rounded-[7px] border border-[rgba(203,208,213,0.22)]" style={{ background: "var(--theme-card,rgba(15,25,45,0.85))" }}>
              <div className="relative min-h-[180px]" style={coverStyle(selectedGallery)}>
                <div className="absolute inset-0 bg-gradient-to-r from-[#040909] via-[#040909]/75 to-transparent" />
                <div className="relative max-w-[360px] p-6">
                  <div className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: "var(--theme-gold,#C8CDD2)" }}>Collector Spotlight</div>
                  <h2 className="mt-3 font-serif text-[33px] font-black leading-[0.95]" style={{ color: "var(--theme-text-primary,#ECEDEF)" }}>Collector Rooms Worth Seeing</h2>
                  <p className="mt-4 text-sm leading-6" style={{ color: "var(--theme-text-primary,#ECEDEF)" }}>Hand-picked public exhibitions from serious collectors around the world.</p>
                  <button type="button" onClick={() => openGallery(selectedGallery)} className="mt-4 rounded-[7px] px-4 py-2 text-xs font-black" style={{ background: "linear-gradient(135deg,#8C9298,#C8CDD2)", color: "#0B0B0B" }}>
                    Explore featured rooms &rarr;
                  </button>
                </div>
                <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
                  {[0, 1, 2, 3, 4].map((dot) => <span key={dot} className="h-2 w-2 rounded-full" style={{ background: dot === 0 ? "var(--theme-gold,#C8CDD2)" : "rgba(240,234,214,0.28)" }} />)}
                </div>
              </div>
            </section>
          )}

          {loading && (
            <div className="mt-5 grid gap-4 md:grid-cols-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((item) => <div key={item} className="h-[180px] animate-pulse rounded-[7px]" style={{ background: "var(--surface)" }} />)}
            </div>
          )}

          {isEmpty && (
            <section className="mt-5 rounded-[7px] border border-[rgba(203,208,213,0.22)] p-10 text-center" style={{ background: "var(--theme-card, rgba(15,25,45,0.85))" }}>
              <div className="flex justify-center" style={{ color: "var(--theme-gold)" }}><Glyph name="search" size={34} /></div>
              <h2 className="mt-3 text-lg font-black" style={{ color: "var(--theme-text-primary, #ECEDEF)" }}>No galleries match</h2>
              <p className="mt-1 text-sm" style={{ color: "var(--theme-text-muted, #61656B)" }}>
                {hasActiveFilter ? "Clear the search or filters to see more public rooms." : "No public galleries yet. Be the first."}
              </p>
              {hasActiveFilter && (
                <button type="button" onClick={() => { setActiveTab("All"); setQuery(""); }} className="mt-4 rounded-[7px] px-4 py-2 text-sm font-black" style={{ background: "linear-gradient(135deg, #8C9298, #C8CDD2)", color: "#0B0B0B" }}>
                  Show All
                </button>
              )}
            </section>
          )}

          {!loading && trending.length > 0 && (
            <section className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-[12px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--theme-gold,#C8CDD2)" }}>Trending Exhibitions</h2>
                <button type="button" onClick={() => toggleSection("trending")} className="text-xs font-bold" style={{ color: "var(--theme-gold,#C8CDD2)" }}>{expanded.trending ? "Show less" : "View all"}</button>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {shown(trending, "trending").map((gallery) => <GalleryCard key={gallery.id} gallery={gallery} />)}
              </div>
            </section>
          )}

          {!loading && newThisWeek.length > 0 && (
            <section className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-[12px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--theme-gold,#C8CDD2)" }}>New This Week</h2>
                <button type="button" onClick={() => toggleSection("newThisWeek")} className="text-xs font-bold" style={{ color: "var(--theme-gold,#C8CDD2)" }}>{expanded.newThisWeek ? "Show less" : "View all"}</button>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {shown(newThisWeek, "newThisWeek").map((gallery) => <GalleryCard key={gallery.id} gallery={gallery} />)}
              </div>
            </section>
          )}

          {!loading && notableItems.length > 0 && (
            <section className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-[12px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--theme-gold,#C8CDD2)" }}>Notable Items</h2>
                <button type="button" onClick={() => toggleSection("notableItems")} className="text-xs font-bold" style={{ color: "var(--theme-gold,#C8CDD2)" }}>{expanded.notableItems ? "Show less" : "View all"}</button>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {shown(notableItems, "notableItems").map((gallery) => <GalleryCard key={gallery.id} gallery={gallery} compact />)}
              </div>
            </section>
          )}

          {!loading && universeCounts.length > 0 && (
            <section className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-[12px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--theme-gold,#C8CDD2)" }}>Across Every Universe</h2>
                <button type="button" onClick={() => setActiveTab("All")} className="text-xs font-bold" style={{ color: "var(--theme-gold,#C8CDD2)" }}>View all</button>
              </div>
              <div className="grid overflow-hidden rounded-[7px] border border-[rgba(203,208,213,0.22)] md:grid-cols-4 xl:grid-cols-8" style={{ background: "var(--theme-card,rgba(15,25,45,0.85))" }}>
                {universeCounts.map(({ key, count }) => (
                  <button key={key} type="button" onClick={() => setActiveTab(key)} className="flex min-h-[58px] items-center gap-2 border-r border-[rgba(203,208,213,0.16)] px-3 text-left transition hover:bg-[rgba(203,208,213,0.06)]">
                    <img src={UNIVERSE_THUMB[key]} alt="" className="h-8 w-8 rounded-[5px] object-cover" />
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-black" style={{ color: "var(--theme-text-primary,#ECEDEF)" }}>{UNIVERSE_LABEL[key]}</span>
                      <span className="block text-[10px]" style={{ color: "var(--theme-text-muted,#61656B)" }}>{count.toLocaleString()} exhibitions</span>
                    </span>
                  </button>
                ))}
                <button type="button" onClick={() => setSwipeOpen(true)} className="flex min-h-[58px] items-center justify-center gap-2 px-3 text-xs font-black" style={{ color: "var(--theme-gold,#C8CDD2)" }}>
                  <Glyph name="cards" size={16} /> View all
                </button>
              </div>
            </section>
          )}

          {!loading && !signedIn && (
            <section className="mt-6 flex flex-col items-center gap-3 rounded-[7px] border border-[rgba(203,208,213,0.22)] px-6 py-8 text-center" style={{ background: "var(--theme-card, rgba(15,25,45,0.85))" }}>
              <div className="text-[11px] tracking-[0.22em]" style={{ color: "var(--theme-text-muted, #61656B)" }}>BUILD YOUR OWN</div>
              <h2 className="text-xl font-black" style={{ color: "var(--theme-text-primary, #ECEDEF)" }}>Create a public gallery</h2>
              <p className="max-w-sm text-sm leading-6" style={{ color: "var(--theme-text-muted, #61656B)" }}>Vault your collection, curate a gallery, and share it with one link.</p>
              <Link href="/museum/new" className="rounded-[7px] px-5 py-2 text-sm font-black transition hover:brightness-105" style={{ background: "linear-gradient(135deg, #8C9298, #C8CDD2)", color: "#0B0B0B" }}>
                Create Gallery
              </Link>
            </section>
          )}
        </div>

        {selectedGallery && (
          <aside className="h-fit rounded-[8px] border border-[rgba(203,208,213,0.32)] p-5 xl:sticky xl:top-24" style={{ background: "var(--theme-card,rgba(15,25,45,0.92))", boxShadow: "0 18px 55px rgba(0,0,0,0.26)" }}>
            <div className="flex items-center justify-between">
              <div className="text-[12px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--theme-gold,#C8CDD2)" }}>Public Exhibition</div>
              <button type="button" onClick={() => setSelectedId(null)} className="text-xl leading-none" style={{ color: "var(--theme-gold,#C8CDD2)" }}>x</button>
            </div>
            <div className="mt-4 h-[230px] rounded-[7px] border border-[rgba(203,208,213,0.22)]" style={coverStyle(selectedGallery)}>
              <div className="flex h-full items-start p-3">
                <span className="rounded-[5px] border border-[rgba(82,214,244,0.35)] bg-black/55 px-2 py-0.5 text-xs font-bold text-[color:var(--info,#52D6F4)]">Public</span>
              </div>
            </div>
            <h2 className="mt-4 font-serif text-[28px] font-black leading-tight" style={{ color: "var(--theme-text-primary,#ECEDEF)" }}>{selectedGallery.title}</h2>
            <div className="mt-2 flex items-center gap-2 text-xs" style={{ color: "var(--theme-text-muted,#61656B)" }}>
              {selectedGallery.collector_avatar_url && <img src={selectedGallery.collector_avatar_url} alt="" className="h-6 w-6 rounded-full object-cover ring-1 ring-white/15" />}
              <span>by {selectedGallery.collector_name ?? "Collector"}</span>
              <span>-</span>
              <span>{selectedGallery.item_count || 0} items</span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-4 border-y border-[rgba(203,208,213,0.18)] py-4">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: "var(--theme-text-muted,#61656B)" }}>Estimated Gallery Value</div>
                <div className="mt-2 text-[28px] font-black text-[color:var(--info,#52D6F4)]">${galleryValue(selectedGallery).toLocaleString()}</div>
              </div>
              <div className="border-l border-[rgba(203,208,213,0.18)] pl-5">
                <div className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: "var(--theme-text-muted,#61656B)" }}>Room Views</div>
                <div className="mt-2 text-[28px] font-black" style={{ color: "var(--theme-gold,#C8CDD2)" }}>{(selectedGallery.analytics_views ?? 0).toLocaleString()}</div>
              </div>
            </div>
            {selectedGallery.description && <p className="mt-4 text-sm leading-6" style={{ color: "var(--theme-text-muted,#61656B)" }}>{selectedGallery.description}</p>}
            <div className="mt-5">
              <div className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--theme-text-muted,#61656B)" }}>Featured Items</div>
              <div className="mt-3 flex gap-2 overflow-hidden">
                {selectedGallery.itemIds.slice(0, 4).map((id) => {
                  const fact = itemFactsById.get(id);
                  return (
                    <div key={id} className="grid h-20 flex-1 place-items-center overflow-hidden rounded-[6px] border border-[rgba(203,208,213,0.22)] bg-black/20">
                      {fact?.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={fact.imageUrl} alt={fact.title || ""} className="h-full w-full object-cover" />
                      ) : (
                        <span className="px-1 text-center text-[8px] uppercase tracking-[0.1em]" style={{ color: "var(--theme-text-muted,#61656B)" }}>No photo</span>
                      )}
                    </div>
                  );
                })}
                {selectedGallery.item_count > 4 && (
                  <div className="grid h-20 w-14 place-items-center rounded-[6px] border border-[rgba(203,208,213,0.22)] text-sm font-black" style={{ color: "var(--theme-gold,#C8CDD2)" }}>+{selectedGallery.item_count - 4}</div>
                )}
              </div>
            </div>
            {/* Only stats backed by real data. "Commenting: On" was hardcoded
                and "Followers" was analytics_views / 4 — both invented. */}
            <div className="mt-5 grid grid-cols-3 divide-x divide-[rgba(203,208,213,0.16)] border-y border-[rgba(203,208,213,0.16)] py-3 text-sm">
              {[
                ["Visibility", "Public"],
                ["Items", selectedGallery.item_count || 0],
                ["Views", (selectedGallery.analytics_views ?? 0).toLocaleString()],
              ].map(([label, value]) => (
                <div key={label} className="px-3 first:pl-0">
                  <div className="text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--theme-text-muted,#61656B)" }}>{label}</div>
                  <div className="mt-1 font-bold text-[color:var(--theme-text-primary,#ECEDEF)]">{value}</div>
                </div>
              ))}
            </div>
            <Link href={`/museum/${selectedGallery.id}/guest`} className="mt-5 flex h-12 items-center justify-center rounded-[7px] text-sm font-black" style={{ background: "linear-gradient(135deg,#8C9298,#C8CDD2)", color: "#0B0B0B" }}>
              View room
            </Link>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => shareGallery(selectedGallery)} className="rounded-[7px] border border-[rgba(203,208,213,0.22)] px-4 py-3 text-sm font-bold" style={{ color: "var(--theme-gold,#C8CDD2)" }}>Share</button>
              <button type="button" onClick={() => reportGallery(selectedGallery)} disabled={reporting} className="rounded-[7px] border border-red-500/45 px-4 py-3 text-sm font-bold text-red-400 disabled:opacity-50">{reporting ? "Sending..." : "Report"}</button>
            </div>
          </aside>
        )}
      </div>
      <DiscoverSwipe open={swipeOpen} onClose={() => setSwipeOpen(false)} />
      </main>
    </>
  );
}
