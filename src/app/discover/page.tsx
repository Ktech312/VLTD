"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

// ── Types ────────────────────────────────────────────────────────────────────

type GalleryCategory =
  | "All"
  | "TCG"
  | "Sports"
  | "Music"
  | "Jewelry"
  | "Games"
  | "Pop Culture"
  | "Misc";

const TABS: GalleryCategory[] = [
  "All",
  "Pop Culture",
  "Sports",
  "TCG",
  "Music",
  "Jewelry",
  "Games",
  "Misc",
];

type PublicGallery = {
  id: string;
  title: string;
  description: string | null;
  cover_image: string | null;
  theme_pack: string | null;
  profile_id: string;
  analytics_views: number;
  item_count: number;
};

// ── Category inference ────────────────────────────────────────────────────────

function normalizeText(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function inferGalleryCategory(gallery: PublicGallery): GalleryCategory {
  const text = normalizeText(
    [gallery.title, gallery.description, gallery.theme_pack].filter(Boolean).join(" "),
  );

  if (/pokemon|magic|yugioh|yu gi oh|tcg|trading card|card game|slab|foil|single/.test(text))
    return "TCG";
  if (/sports|rookie|jersey|autograph|memorabilia|baseball|basketball|football|soccer|hockey/.test(text))
    return "Sports";
  if (/vinyl|album|music|record|artist|instrument|signed lp|turntable/.test(text))
    return "Music";
  if (/watch|jewelry|apparel|streetwear|luxury|handbag|limited drop/.test(text))
    return "Jewelry";
  if (/game|console|nintendo|playstation|xbox|sega|atari|cartridge|arcade|controller/.test(text))
    return "Games";
  if (/comic|marvel| dc |figure|toy|manga|funko|prop|statue|pop culture/.test(text))
    return "Pop Culture";

  return "Misc";
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DiscoverPage() {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<GalleryCategory>("All");
  const [galleries, setGalleries] = useState<PublicGallery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) { setLoading(false); return; }

      try {
        const { data } = await supabase
          .from("galleries")
          .select("id, title, description, cover_image, theme_pack, profile_id, analytics_views, item_count")
          .eq("visibility", "PUBLIC")
          .eq("state", "ACTIVE")
          .order("analytics_views", { ascending: false })
          .limit(24);

        setGalleries((data ?? []) as PublicGallery[]);
      } catch {
        // fail silently
      } finally {
        setLoading(false);
      }
    }
    void fetchData();
  }, []);

  // Apply tab + search to the full list
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return galleries.filter((g) => {
      const category = inferGalleryCategory(g);
      const matchesTab = activeTab === "All" || category === activeTab;
      const matchesQuery =
        !q ||
        (g.title ?? "").toLowerCase().includes(q) ||
        (g.description ?? "").toLowerCase().includes(q) ||
        category.toLowerCase().includes(q);
      return matchesTab && matchesQuery;
    });
  }, [galleries, activeTab, query]);

  // Featured: top 6 by views
  const featured = useMemo(
    () => [...filtered].sort((a, b) => (b.analytics_views ?? 0) - (a.analytics_views ?? 0)).slice(0, 6),
    [filtered],
  );

  // Trending: top 6 by item_count
  const trending = useMemo(
    () => [...filtered].sort((a, b) => (b.item_count ?? 0) - (a.item_count ?? 0)).slice(0, 6),
    [filtered],
  );

  const isEmpty = !loading && filtered.length === 0;
  const hasActiveFilter = activeTab !== "All" || query.trim() !== "";

  function resetFilters() {
    setActiveTab("All");
    setQuery("");
  }

  function coverStyle(gallery: PublicGallery) {
    if (gallery.cover_image) {
      return { background: `url(${gallery.cover_image}) center/cover no-repeat` };
    }
    return { background: "linear-gradient(135deg, rgba(245,181,72,0.15), rgba(20,32,55,0.9))" };
  }

  return (
    <main className="min-h-screen text-[color:var(--fg)]">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">

        {/* ── Header ────────────────────────────────────────────── */}
        <section
          className="relative overflow-hidden rounded-[20px] px-5 py-4"
          style={{ background: "var(--theme-card, rgba(15,25,45,0.85))", border: "1px solid var(--theme-border, rgba(245,181,72,0.12))" }}
        >
          <div
            className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(245,181,72,0.10) 0%, transparent 70%)", filter: "blur(30px)" }}
          />
          <div className="relative">
            <div className="text-[11px] tracking-[0.22em]" style={{ color: "var(--theme-text-muted, #A0956B)" }}>
              DISCOVER
            </div>
            <h1 className="mt-1 text-3xl font-black tracking-[-0.04em]" style={{ color: "var(--theme-text-primary, #F0EAD6)" }}>
              Explore Exhibitions
            </h1>
            <p className="mt-1 max-w-xl text-sm leading-6" style={{ color: "var(--theme-text-muted, #A0956B)" }}>
              Browse public exhibitions from collectors across every universe. Filter by category or search by name.
            </p>

            {/* Search */}
            <div
              className="mt-4 flex max-w-md items-center gap-2 rounded-2xl px-4"
              style={{
                background: "var(--theme-elevated, rgba(20,32,55,0.9))",
                border: "1px solid var(--theme-border, rgba(245,181,72,0.14))",
              }}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 opacity-50" fill="none">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                <path d="m16.5 16.5 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search exhibitions…"
                className="flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:opacity-40"
                style={{ color: "var(--theme-text-primary, #F0EAD6)" }}
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} className="text-xs opacity-50 hover:opacity-100">
                  ✕
                </button>
              )}
            </div>
          </div>
        </section>

        {/* ── Tab bar ───────────────────────────────────────────── */}
        <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className="shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition"
              style={
                activeTab === tab
                  ? {
                      background: "linear-gradient(135deg, #8B6914, #F5B548)",
                      color: "#0B0B0B",
                      border: "1px solid transparent",
                    }
                  : {
                      background: "var(--theme-elevated, rgba(20,32,55,0.9))",
                      color: "var(--theme-text-muted, #A0956B)",
                      border: "1px solid var(--theme-border, rgba(245,181,72,0.12))",
                    }
              }
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ── Loading skeletons ─────────────────────────────────── */}
        {loading && (
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-[200px] animate-pulse rounded-[18px]" style={{ background: "var(--surface)" }} />
            ))}
          </div>
        )}

        {/* ── Empty state ───────────────────────────────────────── */}
        {isEmpty && (
          <section
            className="mt-6 rounded-[20px] p-10 text-center"
            style={{ background: "var(--theme-card, rgba(15,25,45,0.85))", border: "1px solid var(--theme-border, rgba(245,181,72,0.12))" }}
          >
            <div className="text-3xl">🔍</div>
            <h2 className="mt-3 text-lg font-black" style={{ color: "var(--theme-text-primary, #F0EAD6)" }}>
              No exhibitions match
            </h2>
            <p className="mt-1 text-sm" style={{ color: "var(--theme-text-muted, #A0956B)" }}>
              {hasActiveFilter
                ? `No results for${activeTab !== "All" ? ` "${activeTab}"` : ""}${query ? ` "${query}"` : ""}.`
                : "No public galleries yet. Be the first!"}
            </p>
            {hasActiveFilter && (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-4 rounded-full px-4 py-2 text-sm font-semibold transition hover:brightness-110"
                style={{
                  background: "linear-gradient(135deg, #8B6914, #F5B548)",
                  color: "#0B0B0B",
                }}
              >
                Show All
              </button>
            )}
          </section>
        )}

        {/* ── Featured Museums ─────────────────────────────────── */}
        {!loading && featured.length > 0 && (
          <section className="mt-6">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <div className="text-[11px] tracking-[0.22em]" style={{ color: "var(--theme-text-muted, #A0956B)" }}>
                FEATURED MUSEUMS
              </div>
              <span className="text-xs" style={{ color: "var(--theme-text-muted, #A0956B)" }}>
                {featured.length} shown
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((gallery) => (
                <Link
                  key={gallery.id}
                  href={`/museum`}
                  className="group relative overflow-hidden rounded-[18px] transition hover:-translate-y-0.5"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <div className="relative h-[130px] overflow-hidden rounded-t-[18px]" style={coverStyle(gallery)}>
                    <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-transparent to-transparent" />
                    <span
                      className="absolute left-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
                      style={{ background: "rgba(245,181,72,0.18)", color: "#F5B548", border: "1px solid rgba(245,181,72,0.28)" }}
                    >
                      {inferGalleryCategory(gallery)}
                    </span>
                  </div>
                  <div className="p-4">
                    <div className="text-sm font-black" style={{ color: "var(--theme-gold, #F5B548)" }}>
                      {gallery.title}
                    </div>
                    {gallery.description && (
                      <div className="mt-1 line-clamp-2 text-xs leading-5" style={{ color: "var(--muted)" }}>
                        {gallery.description}
                      </div>
                    )}
                    <div className="mt-2 text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--muted2)" }}>
                      {gallery.analytics_views > 0 ? `${gallery.analytics_views} views` : "New exhibition"}
                    </div>
                  </div>
                  <div
                    className="absolute inset-0 flex items-center justify-center rounded-[18px] opacity-0 transition group-hover:opacity-100"
                    style={{ background: "rgba(0,0,0,0.55)" }}
                  >
                    <span
                      className="rounded-full px-4 py-2 text-xs font-bold"
                      style={{ background: "var(--theme-gold, #F5B548)", color: "#0B0B0B" }}
                    >
                      View Exhibition
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Trending Exhibitions ─────────────────────────────── */}
        {!loading && trending.length > 0 && (
          <section className="mt-8">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <div className="text-[11px] tracking-[0.22em]" style={{ color: "var(--theme-text-muted, #A0956B)" }}>
                TRENDING EXHIBITIONS
              </div>
              <span className="text-xs" style={{ color: "var(--theme-text-muted, #A0956B)" }}>
                Most items
              </span>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {trending.map((gallery) => (
                <Link
                  key={gallery.id}
                  href={`/museum`}
                  className="group w-[220px] flex-none overflow-hidden rounded-[16px] transition hover:-translate-y-0.5"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <div className="relative h-[120px] overflow-hidden rounded-t-[16px]" style={coverStyle(gallery)}>
                    <span
                      className="absolute left-2 top-2 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em]"
                      style={{ background: "rgba(245,181,72,0.18)", color: "#F5B548", border: "1px solid rgba(245,181,72,0.28)" }}
                    >
                      {inferGalleryCategory(gallery)}
                    </span>
                  </div>
                  <div className="p-3">
                    <div className="line-clamp-1 text-sm font-semibold" style={{ color: "var(--fg)" }}>
                      {gallery.title}
                    </div>
                    <div className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
                      {gallery.analytics_views > 0 ? `${gallery.analytics_views} views` : "New"}
                      {gallery.item_count > 0 ? ` · ${gallery.item_count} items` : ""}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Start collecting CTA ────────────────────────────── */}
        {!loading && (
          <section
            className="mt-10 flex flex-col items-center gap-3 rounded-[20px] px-6 py-8 text-center"
            style={{ background: "var(--theme-card, rgba(15,25,45,0.85))", border: "1px solid var(--theme-border, rgba(245,181,72,0.12))" }}
          >
            <div className="text-[11px] tracking-[0.22em]" style={{ color: "var(--theme-text-muted, #A0956B)" }}>
              BUILD YOUR OWN
            </div>
            <h2 className="text-xl font-black" style={{ color: "var(--theme-text-primary, #F0EAD6)" }}>
              Create a public exhibition
            </h2>
            <p className="max-w-sm text-sm leading-6" style={{ color: "var(--theme-text-muted, #A0956B)" }}>
              Vault your collection, curate a gallery, and share it with one link.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/museum/new"
                className="rounded-full px-5 py-2 text-sm font-black transition hover:brightness-105"
                style={{
                  background: "linear-gradient(135deg, #8B6914 0%, #C8941F 30%, #F5B548 60%, #C8941F 100%)",
                  color: "#0B0B0B",
                }}
              >
                Create Exhibition
              </Link>
              <Link
                href="/vault"
                className="rounded-full border px-5 py-2 text-sm font-semibold transition hover:brightness-110"
                style={{ borderColor: "rgba(245,181,72,0.28)", color: "#F5B548", background: "rgba(245,181,72,0.06)" }}
              >
                Go to Vault →
              </Link>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
