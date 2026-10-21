"use client";

import { PillSelect } from "@/components/ui/PillSelect";
import { PillButton } from "@/components/ui/PillButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { publicItemsTable } from "@/lib/publicItemsSource";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import DiscoverSwipe from "@/components/DiscoverSwipe";
import FeaturedRoomsCarousel, { type FeaturedRoomSlide } from "@/components/discover/FeaturedRoomsCarousel";
import { PageHeader } from "@/components/layout/PageHeader";
import { DiscoverNav } from "@/components/SectionNav";
import { Glyph } from "@/components/ui/Glyph";
import { getCurrentUser, getOnboardingStatus } from "@/lib/auth";
import { readUniversePrefs } from "@/lib/universePrefs";
import { buildUserPreferences, sortByPersonalization } from "@/lib/personalization";
import { getSeedAvatarUrlForProfile, isRenderableAvatarUrl } from "@/lib/seedAvatar";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { getGalleryThemeBackground, normalizeSupabaseItemIds } from "@/lib/galleryModel";
import { showToast } from "@/lib/toast";
import { isUniverseKey, type UniverseKey, UNIVERSE_KEYS, UNIVERSE_LABEL } from "@/lib/taxonomy";
import { loadItems } from "@/lib/vaultModel";
import { queryPublicGalleries } from "@/lib/publicGalleries";
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

// value is null unless the owner's public item record carries an explicit current value. A missing value is "not shown", never $0.
type GalleryItemFact = { value: number | null; imageUrl: string | null; title: string };

// What the exhibition itself publishes about an item (its public snapshot): enough to count and picture it, never a price.
type SnapshotFact = { title: string; imageUrl: string | null; hidden: boolean };

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
  /** The exhibition's configured room background (uploaded image), if any. The theme pack background is the fallback. */
  shelfBackground: string | null;
  snapshots: Record<string, SnapshotFact>;
  universeKey: UniverseKey;
  created_at?: string | null;
  /** Set when the exhibition's curator is shown under an alias. */
  alias_name?: string;
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
  // Same fallback chain every other surface uses (owner list, editor, guest
  // view) instead of only checking layout.itemIds — this file used to have
  // its own narrower copy that skipped exhibition_layout.itemIds entirely,
  // which is exactly the kind of divergence that made Discover's count
  // disagree with everywhere else (NYCC launch blocker #1).
  const itemIds = normalizeSupabaseItemIds(row);
  const themePack = typeof layout?.themePack === "string" ? layout.themePack : null;
  const exLayout = row.exhibition_layout && typeof row.exhibition_layout === "object" ? (row.exhibition_layout as Record<string, unknown>) : null;
  const rawShelf = layout?.shelfBackground ?? exLayout?.shelfBackground;
  const rawSnaps = layout?.publicItemSnapshots ?? exLayout?.publicItemSnapshots;
  const snapshots: Record<string, SnapshotFact> = {};
  if (Array.isArray(rawSnaps)) {
    for (const snap of rawSnaps) {
      const rec = snap as Record<string, unknown> | null;
      const id = rec && typeof rec.id === "string" ? rec.id : "";
      if (!id) continue;
      const hidden = rec?.hidden === true;
      const image = typeof rec?.imageFrontUrl === "string" && rec.imageFrontUrl ? rec.imageFrontUrl : null;
      snapshots[id] = { title: hidden ? "Hidden Item" : String(rec?.title ?? ""), imageUrl: hidden ? null : image, hidden };
    }
  }

  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    description: typeof row.description === "string" ? row.description : null,
    cover_image: typeof row.cover_image === "string" && row.cover_image ? row.cover_image : null,
    profile_id: String(row.profile_id ?? ""),
    // An exhibition that uses an alias is shown under the alias, never under the real collector.
    alias_name: row.alias_enabled === true && typeof row.alias_name === "string" && row.alias_name.trim() ? row.alias_name.trim().slice(0, 60) : undefined,
    analytics_views: typeof row.analytics_views === "number" ? row.analytics_views : 0,
    item_count: itemIds.length,
    theme_pack: themePack,
    layout,
    itemIds,
    shelfBackground: typeof rawShelf === "string" && rawShelf.trim() ? rawShelf.trim() : null,
    snapshots,
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
  const [attempt, setAttempt] = useState(0);
  const [swipeOpen, setSwipeOpen] = useState(false);
  // /discover?flip=1 (the links named "The Flip" on Saved) opens the deck straight away.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("flip") === "1") setSwipeOpen(true);
  }, []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Close on the details panel really closes it (the first room used to take its place).
  const [panelClosed, setPanelClosed] = useState(false);
  const [sort, setSort] = useState<"recommended" | "views" | "items" | "newest" | "az">("recommended");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [reporting, setReporting] = useState(false);
  const [itemFactsById, setItemFactsById] = useState<Map<string, GalleryItemFact>>(new Map());
  const [userPrefs, setUserPrefs] = useState<ReturnType<typeof buildUserPreferences> | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  // Discover browses OTHER people's public exhibitions, so its universe filter always offers every universe. Your own "Universes displayed"
  // setting only filters your own collection (Vault, Home, Insights) and is not applied here.
  const visibleUniverseKeys: UniverseKey[] = UNIVERSE_KEYS;

  useEffect(() => {
    let active = true;
    async function loadUser() {
      const { data } = await getCurrentUser();
      if (!active) return;
      setSignedIn(Boolean(data.user));

      if (data.user) {
        try {
          const status = await getOnboardingStatus();
          const prefs = readUniversePrefs(status.activeProfile as unknown as Record<string, unknown> | null);
          // Start on what you collect.
          const first = prefs.interests[0];
          if (first) setActiveTab(first);
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
      setFetchError(null);
      setLoading(true);
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        setLoading(false);
        return;
      }

      try {
        // read through the sanitised public view (no profile id for an alias exhibition); the table only if the view is missing
        const { data, error } = await queryPublicGalleries(
          supabase,
          "id, title, description, cover_image, profile_id, analytics_views, layout, exhibition_layout, created_at, alias_enabled, alias_name, alias_avatar",
          (q) => q.eq("visibility", "PUBLIC").eq("state", "ACTIVE").order("analytics_views", { ascending: false }).limit(100)
        );

        if (error) {
          setFetchError(error.message ?? "Could not load exhibitions.");
          setLoading(false);
          return;
        }

        const mapped = (data ?? []).map((row) => rowToGallery(row as Record<string, unknown>));
        const allItemIds = [...new Set(mapped.flatMap((gallery) => gallery.itemIds))];

        if (allItemIds.length > 0) {
          // Pull value + image too, so gallery value and featured items are the
          // real items rather than invented numbers and a repeated cover.
          // In chunks: hundreds of ids in one request make a URL some servers refuse.
          const table = await publicItemsTable(supabase);
          const chunks: string[][] = [];
          for (let i = 0; i < allItemIds.length; i += 80) chunks.push(allItemIds.slice(i, i + 80));
          const chunkResults = await Promise.all(chunks.map((ids) => supabase
            .from(table)
            .select("id, profile_id, universe, current_value, image_front_url, title")
            .in("id", ids)));
          const itemRows = chunkResults.flatMap((result) => result.data ?? []);
          const itemRowsError = chunkResults.find((result) => result.error)?.error ?? null;
          if (itemRowsError) {
            // Non-fatal — the gallery list above already rendered. Items
            // just fall back to $0/no-image until this succeeds, but that
            // fallback should never be silent.
            console.error("Discover: failed to load item facts for galleries:", itemRowsError);
          }
          const itemUniverseMap = new Map<string, UniverseKey>();
          const itemFacts = new Map<string, GalleryItemFact>();
          // An exhibit only counts items from its own profile.
          const ownedPairs = new Set(mapped.flatMap((gallery) => gallery.itemIds.map((itemId) => `${itemId}|${gallery.profile_id || "*"}`)));
          for (const raw of itemRows ?? []) {
            const row = raw as Record<string, unknown>;
            const id = String(row.id);
            if (!ownedPairs.has(`${id}|${String(row.profile_id ?? "")}`) && !ownedPairs.has(`${id}|*`)) continue;
            const universe = String(row.universe ?? "").toUpperCase();
            if (isUniverseKey(universe)) itemUniverseMap.set(id, universe);
            const explicitValue = Number(row.current_value ?? 0);
            itemFacts.set(id, {
              value: explicitValue > 0 ? explicitValue : null,
              imageUrl: typeof row.image_front_url === "string" ? row.image_front_url : null,
              title: String(row.title ?? ""),
            });
          }
          setItemFactsById(itemFacts);
          for (const gallery of mapped) {
            // Stored gallery layouts can retain an id after its vault item is
            // deleted.  Public counts and featured-item previews must describe
            // the rows a visitor can actually see, not stale layout ids.
            // A visitor sees an item if it is public in the vault OR the exhibition itself published it (its public snapshot) -
            // the room shows all of those, so the count on Discover must too. When the public read failed, only items the exhibition itself
            // published (its public snapshots) are counted: the room's own list can include private items, and a count must never reveal those.
            gallery.itemIds = itemRowsError
              ? gallery.itemIds.filter((itemId) => gallery.snapshots[itemId])
              : gallery.itemIds.filter((itemId) => itemFacts.has(itemId) || gallery.snapshots[itemId]);
            gallery.item_count = gallery.itemIds.length;
            gallery.universeKey = computeGalleryUniverse(gallery.itemIds, itemUniverseMap, gallery);
          }
        } else {
          for (const gallery of mapped) gallery.universeKey = inferUniverseKeyFromText(gallery);
        }

        // The real profile of an alias exhibition is not looked up at all (its name and avatar must not reach the page).
        const profileIds = [...new Set(mapped.filter((gallery) => !gallery.alias_name).map((gallery) => gallery.profile_id).filter(Boolean))];
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
            collector_name: gallery.alias_name ?? profileMap.get(gallery.profile_id)?.name ?? "Collector",
            collector_avatar_url: gallery.alias_name ? "" : profileMap.get(gallery.profile_id)?.avatarUrl ?? "",
          })));
        } else {
          setGalleries(mapped.map((gallery) => (gallery.alias_name ? { ...gallery, collector_name: gallery.alias_name, collector_avatar_url: "" } : gallery)));
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
  }, [attempt]);

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

  // A failed load is never an empty list: the could-not-load card below replaces "No exhibitions match".
  const isEmpty = !loading && filtered.length === 0 && !fetchError;
  const hasActiveFilter = activeTab !== "All" || query.trim() !== "";
  const galleryTime = (gallery: PublicGallery) => (gallery.created_at ? Date.parse(gallery.created_at) : 0);
  const displayGalleries = (() => {
    // Exactly what matched: when nothing does, the empty message stands alone (it used to fall back to listing every room underneath).
    const base = filtered;
    const list = [...base];
    if (sort === "views") list.sort((a, b) => (b.analytics_views ?? 0) - (a.analytics_views ?? 0));
    else if (sort === "items") list.sort((a, b) => (b.item_count ?? 0) - (a.item_count ?? 0));
    else if (sort === "az") list.sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === "newest") list.sort((a, b) => galleryTime(b) - galleryTime(a));
    return list;
  })();
  const selectedGallery = panelClosed ? null : displayGalleries.find((gallery) => gallery.id === selectedId) ?? displayGalleries[0] ?? null;

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
  const universeCounts = visibleUniverseKeys.map((key) => ({
    key,
    count: galleries.filter((gallery) => gallery.universeKey === key).length,
  })).filter((item) => item.count > 0).slice(0, 7);

  function coverStyle(gallery: PublicGallery) {
    if (gallery.cover_image) return { background: `url(${gallery.cover_image}) center/cover no-repeat` };
    return { background: `url(${UNIVERSE_THUMB[gallery.universeKey] ?? UNIVERSE_THUMB.MISC}) center/cover no-repeat` };
  }

  // Public figure only: the explicit current value on the public item records. Purchase cost is never read here, and an item
  // with no published value adds nothing. If no item carries one, the answer is "not shown", not a confirmed $0.
  function galleryValue(gallery: PublicGallery): { text: string; note: string | null } {
    let total = 0;
    let valued = 0;
    for (const id of gallery.itemIds) {
      const value = itemFactsById.get(id)?.value;
      if (typeof value === "number" && value > 0) { total += value; valued += 1; }
    }
    if (valued === 0) return { text: "Value not shown", note: null };
    const count = gallery.itemIds.length;
    return { text: `$${total.toLocaleString()}`, note: valued < count ? `from ${valued} of ${count} items` : null };
  }

  // The room's configured background: its uploaded image, else its theme pack's. Never the cover thumbnail.
  function roomBackground(gallery: PublicGallery): string {
    return gallery.shelfBackground ?? getGalleryThemeBackground(gallery.theme_pack ?? undefined);
  }

  const featuredRooms = displayGalleries.filter((gallery) => gallery.item_count > 0).slice(0, 8);
  const carouselSlides: FeaturedRoomSlide[] = featuredRooms.slice(0, 5).map((gallery) => ({
    id: gallery.id,
    title: gallery.title,
    collectorName: gallery.collector_name ?? "Collector",
    itemCount: gallery.item_count,
    universeLabel: UNIVERSE_LABEL[gallery.universeKey],
    backgroundUrl: roomBackground(gallery),
    coverUrl: gallery.cover_image,
    href: `/museum/${gallery.id}/guest`,
  }));
  function showFeaturedRooms() {
    setExpanded((prev) => ({ ...prev, featured: true }));
    window.setTimeout(() => document.getElementById("featured-rooms")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function openGallery(gallery: PublicGallery) {
    router.push(`/museum/${gallery.id}/guest`);
  }

  function GalleryValueText({ gallery, large = false }: { gallery: PublicGallery; large?: boolean }) {
    const { text, note } = galleryValue(gallery);
    const missing = note === null && text === "Value not shown";
    return (
      <div className={large ? "mt-2" : "mt-1"} data-testid="gallery-value">
        <div className={large ? "text-[28px] font-black" : "text-[14px] font-black"} style={{ color: missing ? "var(--theme-text-muted,#61656B)" : "var(--info,#52D6F4)", fontSize: missing ? (large ? 18 : 12) : undefined, fontWeight: missing ? 700 : undefined }}>{text}</div>
        {note && <div className="text-[10px]" style={{ color: "var(--theme-text-muted,#61656B)" }}>{note}</div>}
      </div>
    );
  }

  function GalleryCard({ gallery, compact = false }: { gallery: PublicGallery; compact?: boolean }) {
    return (
      <button
        type="button"
        onClick={() => { setSelectedId(gallery.id); setPanelClosed(false); }}
        onDoubleClick={() => openGallery(gallery)}
        className="group overflow-hidden rounded-[7px] border text-left transition hover:-translate-y-0.5"
        style={{
          background: "var(--theme-card, rgba(15,25,45,0.85))",
          borderColor: selectedGallery?.id === gallery.id ? "#4FD3EE" : "rgba(203,208,213,0.22)",
        }}
      >
        {!compact && (
          <div className="vltd-dark-surface relative h-[128px]" style={coverStyle(gallery)}>
            <div className="absolute inset-0 bg-gradient-to-t from-[#030809] via-black/20 to-transparent" />
            <span className="absolute left-3 top-3 rounded-[5px] border border-[rgba(203,208,213,0.28)] bg-black/50 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em]" style={{ color: "#C8CDD2" }}>
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
            {!compact && <GalleryValueText gallery={gallery} />}
          </div>
          {compact && <div className="self-center text-right"><GalleryValueText gallery={gallery} /></div>}
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
      <DiscoverNav activeKey="explore" />
      <div className="mx-auto grid max-w-[1480px] gap-6 px-4 pb-6 sm:px-6 lg:px-8 xl:grid-cols-[minmax(0,1fr)_430px]">
        <div className="min-w-0">
          <p className="mt-5 text-xs" style={{ color: "var(--theme-text-muted,#61656B)" }} data-testid="discover-filter-note">
            Browsing public exhibitions from every collector. These filters do not change what your own Vault shows.
          </p>
          <div className="mt-2 grid gap-3 lg:grid-cols-[minmax(0,1fr)_200px_200px]">
            <label className="flex h-10 items-center gap-2 rounded-[7px] border border-[rgba(203,208,213,0.22)] px-3" style={{ background: "var(--theme-card,rgba(15,25,45,0.85))" }}>
              <Glyph name="search" size={15} className="opacity-60" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search exhibitions, items, and collectors..." className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:opacity-45" />
            </label>
            <PillSelect
              value={activeTab}
              ariaLabel="Filter public exhibitions by universe"
              align="left"
              minWidthPx={150}
              onChange={(next) => setActiveTab(next === "All" ? "All" : (next as UniverseKey))}
              options={[{ value: "All", label: "All universes" }, ...visibleUniverseKeys.map((key) => ({ value: key as string, label: UNIVERSE_LABEL[key] }))]}
            />
            <PillSelect
              value={sort}
              ariaLabel="Sort exhibitions"
              align="right"
              minWidthPx={150}
              onChange={(next) => setSort(next)}
              options={[
                { value: "recommended", label: "Recommended" },
                { value: "views", label: "Most viewed" },
                { value: "items", label: "Most items" },
                { value: "newest", label: "Newest" },
                { value: "az", label: "A to Z" },
              ]}
            />
          </div>

          {fetchError && (
            <div role="alert" data-testid="discover-load-failed" className="mt-3 flex flex-wrap items-center gap-3 rounded-[7px] border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              <span>We couldn&apos;t load the exhibitions just now. Check your connection and try again.</span>
              <PillButton size="compact" onClick={() => setAttempt((n) => n + 1)}>Try again</PillButton>
            </div>
          )}

          {carouselSlides.length > 0 && (
            <section className="mt-4" aria-label="Collector spotlight">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: "var(--theme-gold,#C8CDD2)" }}>Collector Spotlight</div>
                  <h2 className="font-serif text-[22px] font-black leading-tight" style={{ color: "var(--theme-text-primary,#ECEDEF)" }}>Collector Rooms Worth Seeing</h2>
                </div>
                <PillButton variant="active" onClick={showFeaturedRooms}>Explore featured rooms &rarr;</PillButton>
              </div>
              <FeaturedRoomsCarousel slides={carouselSlides} />
            </section>
          )}

          {!loading && featuredRooms.length > 0 && (
            <section className="mt-5" id="featured-rooms" data-testid="featured-rooms">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-[12px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--theme-gold,#C8CDD2)" }}>Featured Rooms</h2>
                <PillButton size="compact" onClick={() => toggleSection("featured")}>{expanded.featured ? "Show less" : "View all"}</PillButton>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {shown(featuredRooms, "featured").map((gallery) => <GalleryCard key={gallery.id} gallery={gallery} />)}
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
              <h2 className="mt-3 text-lg font-black" style={{ color: "var(--theme-text-primary, #ECEDEF)" }}>No exhibitions match</h2>
              <p className="mt-1 text-sm" style={{ color: "var(--theme-text-muted, #61656B)" }}>
                {hasActiveFilter ? "Clear the search or filters to see more public rooms." : "No public exhibitions yet. Be the first."}
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
                <PillButton size="compact" onClick={() => toggleSection("trending")}>{expanded.trending ? "Show less" : "View all"}</PillButton>
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
                <PillButton size="compact" onClick={() => toggleSection("newThisWeek")}>{expanded.newThisWeek ? "Show less" : "View all"}</PillButton>
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
                <PillButton size="compact" onClick={() => toggleSection("notableItems")}>{expanded.notableItems ? "Show less" : "View all"}</PillButton>
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
                <PillButton size="compact" onClick={() => setActiveTab("All")}>View all</PillButton>
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
                <PillButton className="m-1" onClick={() => setSwipeOpen(true)}><Glyph name="cards" size={16} /> View all</PillButton>
              </div>
            </section>
          )}

          {!loading && !signedIn && (
            <section className="mt-6 flex flex-col items-center gap-3 rounded-[7px] border border-[rgba(203,208,213,0.22)] px-6 py-8 text-center" style={{ background: "var(--theme-card, rgba(15,25,45,0.85))" }}>
              <div className="text-[11px] tracking-[0.22em]" style={{ color: "var(--theme-text-muted, #61656B)" }}>BUILD YOUR OWN</div>
              <h2 className="text-xl font-black" style={{ color: "var(--theme-text-primary, #ECEDEF)" }}>Create a public exhibition</h2>
              <p className="max-w-sm text-sm leading-6" style={{ color: "var(--theme-text-muted, #61656B)" }}>Vault your collection, curate an exhibition, and share it with one link.</p>
              <Link href="/museum/new" className="rounded-[7px] px-5 py-2 text-sm font-black transition hover:brightness-105" style={{ background: "linear-gradient(135deg, #8C9298, #C8CDD2)", color: "#0B0B0B" }}>
                Create Exhibition
              </Link>
            </section>
          )}
        </div>

        {selectedGallery && (
          <aside className="h-fit rounded-[8px] border border-[rgba(203,208,213,0.32)] p-5 xl:sticky xl:top-24" style={{ background: "var(--theme-card,rgba(15,25,45,0.92))", boxShadow: "0 18px 55px rgba(0,0,0,0.26)" }}>
            <div className="flex items-center justify-between">
              <div className="text-[12px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--theme-gold,#C8CDD2)" }}>Public Exhibition</div>
              <PillButton onClick={() => { setSelectedId(null); setPanelClosed(true); }} ariaLabel="Close" title="Close" className="px-0! w-11 md:w-9"><AppIcon name="close" size={16} /></PillButton>
            </div>
            <div className="mt-4 h-[230px] rounded-[7px] border border-[rgba(203,208,213,0.22)]" style={coverStyle(selectedGallery)}>
              <div className="flex h-full items-start p-3">
                <span className="vltd-dark-surface rounded-[5px] border border-[rgba(82,214,244,0.35)] bg-black/55 px-2 py-0.5 text-xs font-bold text-[color:var(--info,#52D6F4)]">Public</span>
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
                <div className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: "var(--theme-text-muted,#61656B)" }}>Estimated Exhibition Value</div>
                <GalleryValueText gallery={selectedGallery} large />
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
                  const snap = selectedGallery.snapshots[id];
                  // Prefer the public item record; the room's own public snapshot covers items that are only public inside the room.
                  const fact = snap?.hidden ? undefined : (itemFactsById.get(id)?.imageUrl ? itemFactsById.get(id) : snap ? { imageUrl: snap.imageUrl, title: snap.title } : itemFactsById.get(id));
                  return (
                    <div key={id} className="grid h-20 flex-1 place-items-center overflow-hidden rounded-[6px] border border-[rgba(203,208,213,0.22)] bg-black/20">
                      {fact?.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={fact.imageUrl} alt={fact.title || ""} className="h-full w-full object-cover" />
                      ) : (
                        <span className="px-1 text-center text-[8px] uppercase tracking-[0.1em]" style={{ color: "var(--theme-text-muted,#61656B)" }}>{snap?.hidden ? "Hidden item" : "No photo"}</span>
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
