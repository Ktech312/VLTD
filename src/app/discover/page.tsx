"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type PublicGallery = {
  id: string;
  title: string;
  cover_image: string;
  profile_id: string;
  analytics_views: number;
};

type PublicProfile = {
  id: string;
  display_name: string;
  username: string;
};

const FILTER_TABS = ["For You", "Trending", "Art Toys", "Sneakers", "Watches", "Comics", "All"] as const;

export default function DiscoverPage() {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<string>("For You");
  const [galleries, setGalleries] = useState<PublicGallery[]>([]);
  const [profiles, setProfiles] = useState<PublicProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) { setLoading(false); return; }

      try {
        const { data: galleriesData } = await supabase
          .from("galleries")
          .select("id,title,cover_image,profile_id,analytics_views")
          .eq("visibility", "PUBLIC")
          .eq("state", "ACTIVE")
          .order("analytics_views", { ascending: false })
          .limit(8);

        const fetched = (galleriesData ?? []) as PublicGallery[];
        setGalleries(fetched);

        const profileIds = [...new Set(fetched.map((g) => g.profile_id).filter(Boolean))].slice(0, 6);
        if (profileIds.length > 0) {
          const { data: profilesData } = await supabase
            .from("profiles")
            .select("id,display_name,username")
            .in("id", profileIds)
            .limit(6);
          setProfiles((profilesData ?? []) as PublicProfile[]);
        }
      } catch {
        // fail silently — show empty states
      } finally {
        setLoading(false);
      }
    }
    void fetchData();
  }, []);

  const featuredGalleries = galleries.slice(0, 6);

  return (
    <main className="min-h-screen text-[color:var(--fg)]">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">

        {/* Page header */}
        <div className="mb-8">
          <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">DISCOVER</div>
          <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Explore Collections</h1>
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            Browse public museums and collectors from around the world.
          </p>
        </div>

        {/* SECTION 1 — Search */}
        <div className="mb-6 flex justify-center">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search collectors, exhibitions, pieces..."
            className="h-12 w-full max-w-2xl rounded-2xl px-5 text-sm outline-none transition"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--fg)",
            }}
          />
        </div>

        {/* SECTION 2 — Filter tabs */}
        <div className="mb-8 flex flex-wrap gap-2">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className="rounded-full px-4 py-1.5 text-sm font-semibold transition"
              style={
                activeTab === tab
                  ? { background: "var(--theme-gold, #F5B548)", color: "#0B0B0B", border: "1px solid transparent" }
                  : { background: "transparent", border: "1px solid var(--theme-gold-border, rgba(245,181,72,0.3))", color: "var(--fg)" }
              }
            >
              {tab}
            </button>
          ))}
        </div>

        {/* SECTION 3 — Featured Museums */}
        <div className="mb-10">
          <div className="mb-4 text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">FEATURED MUSEUMS</div>
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-[180px] animate-pulse rounded-[18px]" style={{ background: "var(--surface)" }} />
              ))}
            </div>
          ) : featuredGalleries.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-3">
              {featuredGalleries.map((gallery) => (
                <Link
                  key={gallery.id}
                  href="/museum"
                  className="group relative overflow-hidden rounded-[18px] p-4 transition hover:-translate-y-0.5"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <div
                    className="mb-3 h-[110px] overflow-hidden rounded-[12px]"
                    style={{
                      background: gallery.cover_image
                        ? `url(${gallery.cover_image}) center/cover no-repeat`
                        : "linear-gradient(135deg, rgba(245,181,72,0.15), rgba(20,32,55,0.9))",
                      border: "1px solid var(--border)",
                    }}
                  />
                  <div className="text-sm font-bold" style={{ color: "var(--theme-gold, #F5B548)" }}>
                    {gallery.title}
                  </div>
                  <div className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
                    {gallery.analytics_views > 0 ? `${gallery.analytics_views} views` : "New exhibition"}
                  </div>
                  <div
                    className="absolute inset-0 flex items-center justify-center rounded-[18px] opacity-0 transition group-hover:opacity-100"
                    style={{ background: "rgba(0,0,0,0.55)" }}
                  >
                    <span
                      className="rounded-full px-4 py-2 text-xs font-bold"
                      style={{ background: "var(--theme-gold, #F5B548)", color: "#0B0B0B" }}
                    >
                      View Museum
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div
              className="rounded-[18px] p-8 text-center"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="mb-2 text-3xl">🏛</div>
              <div className="font-semibold" style={{ color: "var(--fg)" }}>Be the first to share your collection</div>
              <div className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                No public museums yet. Create yours and inspire other collectors.
              </div>
              <Link
                href="/museum/new"
                className="mt-4 inline-flex items-center rounded-full px-5 py-2 text-sm font-bold transition"
                style={{ background: "var(--theme-gold, #F5B548)", color: "#0B0B0B" }}
              >
                Create Museum
              </Link>
            </div>
          )}
        </div>

        {/* SECTION 4 — Trending Exhibitions */}
        <div className="mb-10">
          <div className="mb-4 text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">TRENDING EXHIBITIONS</div>
          {loading ? (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-[160px] w-[220px] flex-none animate-pulse rounded-[16px]" style={{ background: "var(--surface)" }} />
              ))}
            </div>
          ) : galleries.length > 0 ? (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {galleries.map((gallery) => (
                <Link
                  key={gallery.id}
                  href="/museum"
                  className="w-[220px] flex-none overflow-hidden rounded-[16px] transition hover:-translate-y-0.5"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <div
                    className="h-[120px]"
                    style={{
                      background: gallery.cover_image
                        ? `url(${gallery.cover_image}) center/cover no-repeat`
                        : "linear-gradient(135deg, rgba(245,181,72,0.12), rgba(15,25,45,0.9))",
                    }}
                  />
                  <div className="p-3">
                    <div className="line-clamp-1 text-sm font-semibold" style={{ color: "var(--fg)" }}>
                      {gallery.title}
                    </div>
                    <div className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
                      {gallery.analytics_views > 0 ? `${gallery.analytics_views} views` : "New"}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div
              className="rounded-[18px] p-8 text-center"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="font-semibold" style={{ color: "var(--fg)" }}>No public exhibitions yet. Create yours and be first.</div>
              <Link
                href="/museum/new"
                className="mt-4 inline-flex items-center rounded-full px-5 py-2 text-sm font-bold transition"
                style={{ background: "var(--theme-gold, #F5B548)", color: "#0B0B0B" }}
              >
                Create Exhibition
              </Link>
            </div>
          )}
        </div>

        {/* SECTION 5 — Top Collectors */}
        <div>
          <div className="mb-4 text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">TOP COLLECTORS</div>
          {loading ? (
            <div className="grid gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-[60px] animate-pulse rounded-[14px]" style={{ background: "var(--surface)" }} />
              ))}
            </div>
          ) : profiles.length > 0 ? (
            <div className="grid gap-2">
              {profiles.map((profile) => (
                <div
                  key={profile.id}
                  className="flex items-center gap-3 rounded-[14px] px-4 py-3"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                    style={{
                      background: "rgba(245,181,72,0.15)",
                      border: "1px solid rgba(245,181,72,0.25)",
                      color: "var(--theme-gold, #F5B548)",
                    }}
                  >
                    {(profile.display_name || profile.username || "?")[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold" style={{ color: "var(--fg)" }}>
                      {profile.display_name || profile.username || "Collector"}
                    </div>
                    {profile.username ? (
                      <div className="text-xs" style={{ color: "var(--muted)" }}>@{profile.username}</div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="rounded-full px-3 py-1 text-xs font-semibold transition"
                    style={{
                      border: "1px solid var(--theme-gold-border, rgba(245,181,72,0.3))",
                      color: "var(--theme-gold, #F5B548)",
                    }}
                  >
                    Follow
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div
              className="rounded-[18px] p-6 text-center"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="text-sm" style={{ color: "var(--muted)" }}>
                No public collectors yet. Be the first to go public!
              </div>
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
