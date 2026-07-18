"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { Glyph } from "@/components/ui/Glyph";

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

const RANK_EMOJI = ["🥇", "🥈", "🥉"];

function typeEmoji(type: Spotlight["type"]) {
  if (type === "artist") return "🧑‍🎨";
  if (type === "brand") return "🏢";
  return "🗝️";
}

type SpotlightTab = "All" | "Collectors" | "Artists & Brands";

// ── Spotlight Card ───────────────────────────────────────────────

function SpotlightCard({ s }: { s: Spotlight }) {
  return (
    <div
      className="flex flex-col gap-3 rounded-[28px] p-5 transition hover:brightness-105"
      style={{
        background: "var(--theme-card, rgba(15,25,45,0.85))",
        border: s.is_featured
          ? "1.5px solid rgba(245,181,72,0.55)"
          : "1px solid var(--theme-border, rgba(245,181,72,0.12))",
        boxShadow: s.is_featured ? "0 0 24px rgba(245,181,72,0.12)" : undefined,
      }}
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-3xl"
          style={{ background: "var(--theme-elevated, rgba(20,32,55,0.9))", border: "1px solid rgba(245,181,72,0.15)" }}
        >
          {s.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.image_url} alt={s.name} className="h-full w-full object-cover" />
          ) : (
            typeEmoji(s.type)
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-black leading-tight" style={{ color: "var(--theme-text-primary, #F0EAD6)" }}>
              {s.name}
            </span>
            {s.is_featured && (
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.15em]"
                style={{ background: "rgba(245,181,72,0.18)", color: "#F5B548", border: "1px solid rgba(245,181,72,0.35)" }}
              >
                ★ Featured
              </span>
            )}
          </div>
          {s.tagline && (
            <p className="mt-0.5 text-sm" style={{ color: "var(--theme-gold, #F5B548)" }}>{s.tagline}</p>
          )}
          <span
            className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize"
            style={{ background: "rgba(255,255,255,0.05)", color: "var(--muted2, #A0956B)" }}
          >
            {s.type}
          </span>
        </div>
      </div>

      {/* Bio */}
      {s.bio && (
        <p
          className="line-clamp-2 text-sm leading-relaxed"
          style={{ color: "var(--muted, #A0956B)" }}
        >
          {s.bio}
        </p>
      )}

      {/* Universe tags */}
      {s.universe_tags && s.universe_tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {s.universe_tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
              style={{ background: "rgba(245,181,72,0.10)", color: "#F5B548", border: "1px solid rgba(245,181,72,0.22)" }}
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
          className="inline-flex items-center gap-1.5 self-start rounded-full px-4 py-2 text-xs font-bold transition hover:brightness-110"
          style={{ background: "linear-gradient(135deg, #8B6914, #F5B548)", color: "#0B0B0B" }}
        >
          {s.link_label || "Visit →"}
        </a>
      )}
    </div>
  );
}

// ── MVPs Sidebar ─────────────────────────────────────────────────

function MVPsSidebar({ mvps, loading }: { mvps: UniverseMVP[]; loading: boolean }) {
  return (
    <div
      className="rounded-[28px] p-5"
      style={{
        background: "var(--theme-card, rgba(15,25,45,0.85))",
        border: "1px solid var(--theme-border, rgba(245,181,72,0.12))",
      }}
    >
      <div className="text-[11px] font-bold uppercase tracking-[0.25em]" style={{ color: "var(--muted2, #A0956B)" }}>
        VLT MVPs
      </div>
      <h2 className="mt-1 text-lg font-black" style={{ color: "var(--theme-text-primary, #F0EAD6)" }}>
        Top Collectors
      </h2>
      <p className="mt-1 text-xs" style={{ color: "var(--muted, #A0956B)" }}>
        Most active collectors by universe
      </p>

      <div className="mt-4 flex flex-col gap-5">
        {loading ? (
          <div className="text-sm" style={{ color: "var(--muted)" }}>Loading MVPs...</div>
        ) : mvps.length === 0 ? (
          <div className="rounded-2xl p-4 text-center text-sm" style={{ background: "var(--theme-elevated)", color: "var(--muted)" }}>
            MVPs coming soon as the community grows 🌱
          </div>
        ) : (
          mvps.map((u) => (
            <div key={u.subject}>
              <div
                className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em]"
                style={{ color: "var(--theme-gold, #F5B548)" }}
              >
                {u.subject}
              </div>
              <div className="flex flex-col gap-1.5">
                {u.entries.map((e, i) => (
                  <div
                    key={e.profile_id}
                    className="flex items-center gap-2 rounded-xl px-3 py-2"
                    style={{ background: "var(--theme-elevated, rgba(20,32,55,0.9))" }}
                  >
                    <span className="text-base shrink-0">{RANK_EMOJI[i] ?? `#${i + 1}`}</span>
                    <span className="text-sm font-semibold flex-1 truncate" style={{ color: "var(--theme-text-primary, #F0EAD6)" }}>
                      {e.display_name}
                    </span>
                    <span className="text-xs shrink-0 tabular-nums" style={{ color: "var(--muted2, #A0956B)" }}>
                      {e.item_count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <p className="mt-5 text-center text-[11px]" style={{ color: "var(--muted2, #A0956B)" }}>
        Rankings celebrate activity, not competition 🤝
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
                avatar_emoji: String(r.avatar_emoji ?? "🗝️"),
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
    <div className="" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <div style={{ background: "var(--theme-elevated, rgba(20,32,55,0.9))", borderBottom: "1px solid var(--theme-border, rgba(245,181,72,0.12))" }}>
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <div className="text-[11px] font-bold uppercase tracking-[0.28em]" style={{ color: "var(--muted2, #A0956B)" }}>
            VLTD Community
          </div>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.04em]" style={{ color: "var(--theme-text-primary, #F0EAD6)" }}>
            🛋️ VLT Lounge
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted, #A0956B)" }}>
            Community spotlights, featured creators, and VLT MVPs
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">

          {/* Left: Spotlights */}
          <div>
            {/* Tab bar */}
            <div className="mb-5 flex gap-2">
              {TABS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className="rounded-full px-4 py-2 text-sm font-semibold transition min-h-[40px]"
                  style={tab === t ? {
                    background: "linear-gradient(135deg, #8B6914, #F5B548)",
                    color: "#0B0B0B",
                  } : {
                    background: "var(--theme-elevated, rgba(20,32,55,0.9))",
                    color: "var(--muted, #A0956B)",
                    border: "1px solid var(--theme-border, rgba(245,181,72,0.12))",
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
                  <div key={i} className="h-44 animate-pulse rounded-[28px]" style={{ background: "var(--theme-card)" }} />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div
                className="flex flex-col items-center gap-3 rounded-[28px] px-6 py-12 text-center"
                style={{ background: "var(--theme-card)", border: "1px solid var(--theme-border)" }}
              >
                <div className="flex justify-center" style={{ color: "var(--theme-gold)" }}><Glyph name="sofa" size={40} /></div>
                <div className="text-lg font-black" style={{ color: "var(--theme-text-primary)" }}>
                  No spotlights yet
                </div>
                <p className="max-w-xs text-sm" style={{ color: "var(--muted)" }}>
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
    </div>
  );
}
