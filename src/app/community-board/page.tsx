"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { Glyph, type GlyphName } from "@/components/ui/Glyph";

// ── Design tokens (match the Command Center / app style) ─────────
const gold = "#C8CDD2";
const goldBright = "#C8CDD2";
const cream = "#ECEDEF";
const muted = "var(--muted, #9BA0A6)";
const dim = "var(--muted2, #61656B)";
const panel = "rgba(4,14,18,0.84)";
const panel2 = "rgba(8,20,27,0.72)";
const border = "var(--theme-border, rgba(255,255,255,0.10))";
const borderSoft = "var(--divider, rgba(255,255,255,0.08))";
const serif = "var(--font-serif, 'Cormorant Garamond', Georgia, serif)";

// ── Types ───────────────────────────────────────────────────────

type Spotlight = {
  id: string;
  type: "collector" | "artist" | "brand";
  name: string;
  tagline: string | null;
  bio: string | null;
  image_url: string | null;
  universe_tags: string[] | null;
  link_url: string | null;
  link_label: string | null;
  is_featured: boolean;
  sort_order: number;
};

type MVPEntry = {
  rank: number;
  profile_id: string;
  display_name: string;
  avatar_emoji: string;
  item_count: number;
};

type UniverseMVP = {
  subject: string;
  entries: MVPEntry[];
};

// ── Helpers ─────────────────────────────────────────────────────

function typeGlyph(type: Spotlight["type"]): GlyphName {
  if (type === "artist") return "palette";
  if (type === "brand") return "building";
  return "key";
}

type SpotlightTab = "All" | "Collectors" | "Artists & Brands";

// ── Gold-glow medallion (the app's icon treatment) ──────────────

function Medallion({ name, size = 40, box = 92 }: { name: GlyphName; size?: number; box?: number }) {
  return (
    <div
      className="relative flex shrink-0 items-center justify-center rounded-[16px] border"
      style={{
        width: box,
        height: box,
        borderColor: border,
        background: "radial-gradient(circle at 50% 28%, rgba(203,208,213,0.20), rgba(2,9,12,0.92) 72%)",
        color: goldBright,
      }}
    >
      <Glyph name={name} size={size} />
    </div>
  );
}

// ── Spotlight Card ───────────────────────────────────────────────

function SpotlightCard({ s }: { s: Spotlight }) {
  return (
    <div
      className="relative flex flex-col gap-3 overflow-hidden rounded-[14px] border p-5 transition hover:brightness-[1.06]"
      style={{
        background: panel,
        borderColor: s.is_featured ? "rgba(203,208,213,0.55)" : border,
        boxShadow: s.is_featured ? "0 0 30px rgba(203,208,213,0.14)" : undefined,
      }}
    >
      {s.is_featured && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(circle at 100% 0%, rgba(203,208,213,0.10), transparent 40%)" }}
        />
      )}

      {/* Header row */}
      <div className="relative flex items-start gap-3">
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[14px] border"
          style={{ background: panel2, borderColor: border, color: goldBright }}
        >
          {s.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.image_url} alt={s.name} className="h-full w-full object-cover" />
          ) : (
            <Glyph name={typeGlyph(s.type)} size={28} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[22px] font-semibold leading-none" style={{ color: cream, fontFamily: serif }}>
              {s.name}
            </span>
            {s.is_featured && (
              <span
                className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.15em]"
                style={{ background: "rgba(203,208,213,0.16)", color: goldBright, border: `1px solid ${border}` }}
              >
                <Glyph name="star" size={10} /> Featured
              </span>
            )}
          </div>
          {s.tagline && (
            <p className="mt-1 text-sm" style={{ color: gold }}>{s.tagline}</p>
          )}
          <span
            className="mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize"
            style={{ background: "rgba(255,255,255,0.04)", color: muted, border: `1px solid ${borderSoft}` }}
          >
            {s.type}
          </span>
        </div>
      </div>

      {/* Bio */}
      {s.bio && (
        <p className="relative line-clamp-2 text-sm leading-relaxed" style={{ color: muted }}>
          {s.bio}
        </p>
      )}

      {/* Universe tags */}
      {s.universe_tags && s.universe_tags.length > 0 && (
        <div className="relative flex flex-wrap gap-1.5">
          {s.universe_tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
              style={{ background: "rgba(203,208,213,0.10)", color: goldBright, border: `1px solid ${border}` }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Link */}
      {s.link_url && (
        <a
          href={s.link_url}
          target="_blank"
          rel="noopener noreferrer"
          className="relative inline-flex items-center gap-1.5 self-start rounded-[8px] px-4 py-2 text-xs font-bold transition hover:brightness-110"
          style={{ background: "linear-gradient(135deg, #8C9298, #C8CDD2)", color: "#0B0B0B" }}
        >
          {s.link_label || "Visit"}
        </a>
      )}
    </div>
  );
}

// ── MVPs Sidebar ─────────────────────────────────────────────────

function MVPsSidebar({ mvps, loading }: { mvps: UniverseMVP[]; loading: boolean }) {
  return (
    <div className="rounded-[14px] border p-5" style={{ background: panel, borderColor: border }}>
      <div className="text-[11px] font-bold uppercase tracking-[0.25em]" style={{ color: dim }}>
        VLT MVPs
      </div>
      <h2 className="mt-1 text-[26px] font-semibold leading-none" style={{ color: cream, fontFamily: serif }}>
        Top Collectors
      </h2>
      <p className="mt-1.5 text-xs" style={{ color: muted }}>
        Most active collectors by universe
      </p>

      <div className="mt-4 flex flex-col gap-5">
        {loading ? (
          <div className="text-sm" style={{ color: muted }}>Loading MVPs…</div>
        ) : mvps.length === 0 ? (
          <div
            className="flex flex-col items-center gap-3 rounded-[12px] border p-6 text-center"
            style={{ background: panel2, borderColor: borderSoft }}
          >
            <Medallion name="trophy" size={26} box={64} />
            <div className="text-[18px] font-semibold" style={{ color: cream, fontFamily: serif }}>
              MVPs coming soon
            </div>
            <p className="text-xs leading-relaxed" style={{ color: muted }}>
              Top collectors appear here as the community grows.
            </p>
          </div>
        ) : (
          mvps.map((u) => (
            <div key={u.subject}>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: goldBright }}>
                {u.subject}
              </div>
              <div className="flex flex-col gap-1.5">
                {u.entries.map((e, i) => (
                  <div
                    key={e.profile_id}
                    className="flex items-center gap-2.5 rounded-[10px] border px-3 py-2"
                    style={{ background: panel2, borderColor: borderSoft }}
                  >
                    <span className="w-5 shrink-0 text-[17px] font-semibold leading-none" style={{ color: goldBright, fontFamily: serif }}>
                      {i + 1}
                    </span>
                    <span className="flex-1 truncate text-sm font-semibold" style={{ color: cream }}>
                      {e.display_name}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums" style={{ color: muted }}>
                      {e.item_count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-[11px]" style={{ color: dim }}>
        <Glyph name="heart" size={12} />
        Rankings celebrate activity, not competition
      </p>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────

export default function VLTLoungePage() {
  const [spotlights, setSpotlights] = useState<Spotlight[]>([]);
  const [spotlightsLoading, setSpotlightsLoading] = useState(true);
  const [mvps, setMvps] = useState<UniverseMVP[]>([]);
  const [mvpsLoading, setMvpsLoading] = useState(true);
  const [tab, setTab] = useState<SpotlightTab>("All");

  // Fetch spotlights
  useEffect(() => {
    async function load() {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) { setSpotlightsLoading(false); return; }
      const { data, error } = await supabase
        .from("spotlights")
        .select("*")
        .eq("enabled", true)
        .order("is_featured", { ascending: false })
        .order("sort_order", { ascending: true });
      if (!error && data) {
        setSpotlights(data as Spotlight[]);
      }
      setSpotlightsLoading(false);
    }
    void load();
  }, []);

  // Fetch MVP data (top subjects → top 3 per subject)
  useEffect(() => {
    async function load() {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) { setMvpsLoading(false); return; }
      try {
        const { data: subjects } = await supabase.rpc("get_top_subjects", { p_limit: 5 });
        if (!subjects || subjects.length === 0) { setMvpsLoading(false); return; }

        const results: UniverseMVP[] = [];
        for (const s of subjects as Array<{ subject: string }>) {
          const { data: board } = await supabase.rpc("get_subject_leaderboard", {
            subject_name: s.subject,
            p_limit: 3,
          });
          if (board && board.length > 0) {
            results.push({
              subject: s.subject,
              entries: (board as Array<Record<string, unknown>>).map((r, i) => ({
                rank: i + 1,
                profile_id: String(r.profile_id ?? ""),
                display_name: String(r.display_name ?? "Collector"),
                avatar_emoji: String(r.avatar_emoji ?? ""),
                item_count: Number(r.item_count ?? 0),
              })),
            });
          }
        }
        setMvps(results);
      } catch { /* silent */ }
      setMvpsLoading(false);
    }
    void load();
  }, []);

  const TABS: SpotlightTab[] = ["All", "Collectors", "Artists & Brands"];

  const filtered = spotlights.filter((s) => {
    if (tab === "All") return true;
    if (tab === "Collectors") return s.type === "collector";
    return s.type === "artist" || s.type === "brand";
  });

  return (
    <main className="min-h-dvh px-4 py-6 sm:px-6 lg:px-8" style={{ background: "var(--bg)" }}>
      <div className="mx-auto max-w-6xl">
        {/* ── Hero header ── */}
        <section className="relative overflow-hidden rounded-[16px] border" style={{ borderColor: border, background: panel }}>
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(circle at 10% 18%, rgba(203,208,213,0.10), transparent 44%)" }}
          />
          <div className="relative flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:gap-7 sm:p-8">
            <Medallion name="sofa" size={44} box={96} />
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.28em]" style={{ color: dim }}>
                VLTD Community
              </p>
              <h1 className="mt-2 text-[40px] font-semibold leading-none sm:text-[46px]" style={{ color: cream, fontFamily: serif }}>
                VLT Lounge
              </h1>
              <p className="mt-2.5 max-w-xl text-[15px]" style={{ color: cream }}>
                Community spotlights, featured creators, and VLT MVPs.
              </p>
            </div>
          </div>
        </section>

        {/* ── Body ── */}
        <div className="mt-7 grid gap-7 lg:grid-cols-[1fr_330px]">
          {/* Left: Spotlights */}
          <div>
            {/* Tab bar */}
            <div className="mb-5 flex flex-wrap gap-2">
              {TABS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className="min-h-[40px] rounded-full px-4 py-2 text-sm font-semibold transition"
                  style={tab === t ? {
                    background: "linear-gradient(135deg, #8C9298, #C8CDD2)",
                    color: "#0B0B0B",
                  } : {
                    background: panel2,
                    color: muted,
                    border: `1px solid ${border}`,
                  }}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Spotlights grid */}
            {spotlightsLoading ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-48 animate-pulse rounded-[14px] border" style={{ background: panel, borderColor: borderSoft }} />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div
                className="relative flex flex-col items-center gap-4 overflow-hidden rounded-[16px] border px-6 py-16 text-center"
                style={{ background: panel, borderColor: border }}
              >
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{ background: "radial-gradient(circle at 50% 0%, rgba(203,208,213,0.08), transparent 46%)" }}
                />
                <div className="relative"><Medallion name="sofa" size={40} box={88} /></div>
                <div className="relative text-[26px] font-semibold" style={{ color: cream, fontFamily: serif }}>
                  No spotlights yet
                </div>
                <p className="relative max-w-sm text-sm leading-relaxed" style={{ color: muted }}>
                  Check back soon — we feature collectors, artists, and brands from across the VLTD community.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {filtered.map((s) => <SpotlightCard key={s.id} s={s} />)}
              </div>
            )}
          </div>

          {/* Right: MVPs */}
          <div>
            <MVPsSidebar mvps={mvps} loading={mvpsLoading} />
          </div>
        </div>
      </div>
    </main>
  );
}
