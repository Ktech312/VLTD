"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { resolveAvatarSrc } from "@/lib/avatarResolve";

/* =========================================================================
   VLT LOUNGE — the collector clubhouse.
   Visual pass (Brushed Console theme, mock data). Backend + real links wired
   in a later pass. No sidebar; full-width 3-column clubhouse.
========================================================================= */

const CYAN = "#4FD3EE";
const GREEN = "#54C98A";

/* ── Mock data ───────────────────────────────────────────────── */
const LIVE_TABS = ["All Activity", "Discussions", "Collector Q&A", "Item Chatter"] as const;

const FEED = [
  { tag: "Discussion", time: "18m ago", title: "Silver Age vs Bronze Age: where's the smart money in 2024?", replies: 23, views: 142, hue: 8 },
  { tag: "Collector Q&A", time: "42m ago", title: "Thoughts on this 1986 Fleer Jordan PSA 9?", replies: 12, views: 85, hue: 212 },
  { tag: "Item Chatter", time: "1h ago", title: "First press UK vinyl — tiny stamper marks, big sound?", replies: 9, views: 63, hue: 260 },
  { tag: "Market Watch", time: "2h ago", title: "Hulk #181 continuing to climb", replies: 7, views: 111, hue: 130 },
];

const HOT = [
  { t: "Best comic pickups under $500 right now?", n: 56 },
  { t: "Are modern comics finally having their moment?", n: 38 },
  { t: "Which rookie cards are you buying now?", n: 42 },
  { t: "Top 5 albums every collection needs", n: 31 },
];

/* Real leaderboard/member types (wired from Supabase below). */
type MvpRow = { profile_id: string; name: string; username: string; avatarEmoji: string; items: number };
type UniverseRow = { subject: string; raw: string; collectors: number };
type MemberRow = { name: string; username: string; joined: string; src: string | null };

function titleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}
function joinedLabel(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (!Number.isFinite(days) || days <= 0) return "Joined today";
  if (days === 1) return "Joined yesterday";
  if (days < 30) return `Joined ${days}d ago`;
  return `Joined ${Math.floor(days / 30)}mo ago`;
}

type DropRow = { name: string; date: string; time: string };
type RoomRow = { title: string; desc: string; image: string | null; linkUrl: string | null; linkLabel: string; tags: string[] };
type Signals = { pulse: number; volume: number; listings: number; sales: number };

function money(n: number) {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}
function dropDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
}
function dropTime(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/* ── Shared bits ─────────────────────────────────────────────── */
const CARD: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 10px rgba(0,0,0,0.16)",
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--muted)" }}>
      {children}
    </span>
  );
}

function Info() {
  return (
    <span className="inline-grid h-3.5 w-3.5 place-items-center rounded-full text-[8px] font-black" style={{ border: "1px solid var(--border-strong, rgba(255,255,255,0.2))", color: "var(--muted2)" }}>i</span>
  );
}

function More({ children = "View all", href }: { children?: React.ReactNode; href?: string }) {
  const cls = "text-[11px] font-bold";
  return href
    ? <Link href={href} className={cls} style={{ color: CYAN }}>{children}</Link>
    : <button type="button" className={cls} style={{ color: CYAN }}>{children}</button>;
}

/* Avatar — real profile image when available, initials otherwise. */
function Avatar({ name, size = 34, src, ring = "var(--border-strong, rgba(255,255,255,0.18))" }: { name: string; size?: number; src?: string | null; ring?: string }) {
  const initials = name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase();
  return (
    <span
      className="inline-grid shrink-0 place-items-center overflow-hidden rounded-[7px] font-black"
      style={{
        width: size, height: size, fontSize: size * 0.36, color: "var(--fg)",
        background: "linear-gradient(165deg, rgba(255,255,255,0.10), rgba(255,255,255,0.02))",
        border: `1px solid ${ring}`,
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        initials
      )}
    </span>
  );
}

/* Placeholder media tile for feed thumbnails / room display. */
function Tile({ hue = 220, className = "", children }: { hue?: number; className?: string; children?: React.ReactNode }) {
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ background: `linear-gradient(150deg, hsl(${hue} 22% 20%), hsl(${hue} 24% 9%))`, border: "1px solid var(--border)" }}
    >
      {children}
    </div>
  );
}

function Spark({ color = GREEN }: { color?: string }) {
  return (
    <svg viewBox="0 0 60 20" className="h-5 w-16" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 15 L10 12 L18 14 L26 8 L34 10 L42 5 L50 7 L59 2" />
    </svg>
  );
}

function Bars({ color = CYAN }: { color?: string }) {
  const h = [7, 11, 6, 13, 9, 15, 12];
  return (
    <svg viewBox="0 0 60 20" className="h-5 w-16">
      {h.map((v, i) => (
        <rect key={i} x={i * 8.4} y={20 - v} width="5.4" height={v} rx="1" fill={color} opacity={0.55 + i * 0.06} />
      ))}
    </svg>
  );
}

function fmt(n: number) {
  return n.toLocaleString("en-US");
}

/* ── Page ────────────────────────────────────────────────────── */
export default function VltLoungePage() {
  const [tab, setTab] = useState<(typeof LIVE_TABS)[number]>("All Activity");
  const [mvp, setMvp] = useState<MvpRow[] | null>(null);
  const [universes, setUniverses] = useState<UniverseRow[] | null>(null);
  const [members, setMembers] = useState<MemberRow[] | null>(null);
  const [signals, setSignals] = useState<Signals | null>(null);
  const [drops, setDrops] = useState<DropRow[] | null>(null);
  const [room, setRoom] = useState<RoomRow | null | undefined>(undefined); // undefined = loading

  // Real leaderboard / universe / member data from Supabase (item-count based).
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setMvp([]); setUniverses([]); setMembers([]); return; }
    let alive = true;
    (async () => {
      try {
        const { data: subjects } = await supabase.rpc("get_top_subjects", { p_limit: 12 });
        const subs = (subjects ?? []) as Array<{ subject: string; collector_count: number; total_items: number }>;
        if (alive) setUniverses(subs.slice(0, 6).map((s) => ({ subject: titleCase(s.subject), raw: s.subject, collectors: Number(s.collector_count ?? 0) })));

        // Aggregate per-subject leaderboards → overall top collectors by items.
        const agg = new Map<string, { name: string; username: string; avatarEmoji: string; items: number }>();
        await Promise.all(
          subs.slice(0, 8).map(async (s) => {
            const { data: board } = await supabase.rpc("get_subject_leaderboard", { p_subject: s.subject, p_limit: 25 });
            (board ?? []).forEach((r: Record<string, unknown>) => {
              const id = String(r.profile_id ?? "");
              if (!id) return;
              const name = String(r.display_name || r.username || "Collector");
              const username = String(r.username ?? "");
              const avatarEmoji = String(r.avatar_emoji ?? "");
              const cur = agg.get(id) ?? { name, username, avatarEmoji, items: 0 };
              cur.items += Number(r.item_count ?? 0);
              cur.name = name;
              if (username) cur.username = username;
              if (avatarEmoji) cur.avatarEmoji = avatarEmoji;
              agg.set(id, cur);
            });
          })
        );
        const top = [...agg.entries()]
          .map(([profile_id, v]) => ({ profile_id, name: v.name, username: v.username, avatarEmoji: v.avatarEmoji, items: v.items }))
          .sort((a, b) => b.items - a.items)
          .slice(0, 5);
        if (alive) setMvp(top);

        const { data: recent } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url, avatar_emoji, created_at")
          .eq("is_public", true)
          .order("created_at", { ascending: false })
          .limit(4);
        if (alive) setMembers((recent ?? []).map((m: Record<string, unknown>) => ({
          name: String(m.display_name || m.username || "Collector"),
          username: String(m.username ?? ""),
          joined: joinedLabel(String(m.created_at ?? "")),
          src: resolveAvatarSrc({
            avatarUrl: (m.avatar_url as string) ?? null,
            avatarEmoji: (m.avatar_emoji as string) ?? null,
            profileId: String(m.id ?? ""),
            displayName: String(m.display_name ?? ""),
          }),
        })));

        // Collector Signals — aggregate RPC (needs the 20260728_collector_signals migration).
        try {
          const { data: sig } = await supabase.rpc("get_collector_signals");
          const row = (Array.isArray(sig) ? sig[0] : sig) as Record<string, unknown> | undefined;
          if (alive) setSignals(row ? {
            pulse: Number(row.pulse_pct ?? 0),
            volume: Number(row.volume_7d ?? 0),
            listings: Number(row.active_listings ?? 0),
            sales: Number(row.sales_7d ?? 0),
          } : null);
        } catch { if (alive) setSignals(null); }

        // Upcoming Lounge Drops — from the Events system.
        const { data: ev } = await supabase
          .from("collector_events")
          .select("name, starts_at")
          .eq("enabled", true)
          .gte("starts_at", new Date().toISOString())
          .order("starts_at", { ascending: true })
          .limit(3);
        if (alive) setDrops((ev ?? []).map((e: Record<string, unknown>) => ({
          name: String(e.name ?? "Event"),
          date: dropDate(String(e.starts_at ?? "")),
          time: dropTime(String(e.starts_at ?? "")),
        })));

        // Room of the Night — featured spotlight.
        const { data: sp } = await supabase
          .from("spotlights")
          .select("name, tagline, bio, image_url, link_url, link_label, universe_tags")
          .eq("is_featured", true)
          .order("sort_order", { ascending: true })
          .limit(1);
        const spot = (Array.isArray(sp) ? sp[0] : sp) as Record<string, unknown> | undefined;
        if (alive) setRoom(spot ? {
          title: String(spot.name ?? "Featured Room"),
          desc: String(spot.bio || spot.tagline || ""),
          image: (typeof spot.image_url === "string" && spot.image_url) ? spot.image_url : null,
          linkUrl: (typeof spot.link_url === "string" && spot.link_url) ? spot.link_url : null,
          linkLabel: (typeof spot.link_label === "string" && spot.link_label) ? spot.link_label : "View Room",
          tags: Array.isArray(spot.universe_tags) ? (spot.universe_tags as string[]) : [],
        } : null);
      } catch {
        if (alive) {
          setMvp((v) => v ?? []); setUniverses((v) => v ?? []); setMembers((v) => v ?? []);
          setSignals(null); setDrops((v) => v ?? []); setRoom((r) => (r === undefined ? null : r));
        }
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap items-end gap-x-5 gap-y-1">
          <h1 className="text-[38px] font-extrabold uppercase leading-[0.9] tracking-[-0.03em] sm:text-[46px]">VLT Lounge</h1>
          <p className="pb-1 text-sm leading-tight" style={{ color: "var(--muted)" }}>
            The collector clubhouse.<br className="hidden sm:block" /> Trusted talk. Real knowledge.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <button type="button" className="inline-flex items-center gap-2 rounded-[6px] px-4 py-2.5 text-sm font-bold" style={{ ...CARD, color: "var(--fg)" }}>
            <span aria-hidden style={{ color: CYAN }}>?</span> Ask the Lounge
          </button>
          <button type="button" className="vltd-primary-button inline-flex items-center gap-2 rounded-[6px] px-4 py-2.5 text-sm font-black">
            Post Update
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)_minmax(0,340px)]">
        {/* ── LEFT: Lounge Live + Hot Threads ── */}
        <div className="flex flex-col gap-4">
          <section className="rounded-[8px]" style={CARD}>
            <div className="flex items-center gap-2 px-4 pt-3.5">
              <Label>Lounge Live</Label>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold" style={{ color: GREEN }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: GREEN, boxShadow: `0 0 8px ${GREEN}` }} />128 online
              </span>
            </div>
            <div className="mt-2.5 flex gap-4 overflow-x-auto px-4 no-scrollbar" style={{ borderBottom: "1px solid var(--border)" }}>
              {LIVE_TABS.map((t) => {
                const active = t === tab;
                return (
                  <button key={t} type="button" onClick={() => setTab(t)} className="relative whitespace-nowrap pb-2.5 text-[12px] font-bold transition" style={{ color: active ? CYAN : "var(--muted)" }}>
                    {t}
                    {active && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full" style={{ background: CYAN, boxShadow: `0 0 8px ${CYAN}` }} />}
                  </button>
                );
              })}
            </div>
            <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
              {FEED.map((f) => (
                <li key={f.title} className="flex gap-3 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black uppercase tracking-[0.14em]" style={{ color: CYAN }}>{f.tag}</span>
                      <span className="text-[10px]" style={{ color: "var(--muted2)" }}>{f.time}</span>
                    </div>
                    <p className="mt-1 text-[13.5px] font-bold leading-snug">{f.title}</p>
                    <div className="mt-1.5 flex gap-3 text-[11px]" style={{ color: "var(--muted2)" }}>
                      <span>{f.replies} replies</span>
                      <span>{f.views} views</span>
                    </div>
                  </div>
                  <Tile hue={f.hue} className="h-14 w-14 shrink-0 rounded-[6px]" />
                </li>
              ))}
            </ul>
            <button type="button" className="w-full px-4 py-3 text-left text-[12px] font-bold" style={{ color: CYAN, borderTop: "1px solid var(--border)" }}>
              View all activity →
            </button>
          </section>

          <section className="rounded-[8px]" style={CARD}>
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
              <Label>Hot Threads</Label>
              <More />
            </div>
            <ul>
              {HOT.map((h) => (
                <li key={h.t} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[12.5px]" style={{ borderBottom: "1px solid var(--border)" }}>
                  <span className="min-w-0 truncate font-semibold" style={{ color: "var(--fg)" }}>{h.t}</span>
                  <span className="shrink-0 rounded-[4px] px-1.5 py-0.5 text-[11px] font-bold" style={{ background: "var(--pill)", color: "var(--muted)" }}>{h.n}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* ── CENTER: Room of the Night + New Members ── */}
        <div className="flex flex-col gap-4">
          <section className="rounded-[8px] overflow-hidden" style={CARD}>
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
              <Label>Room of the Night</Label>
              <span className="text-[11px]" style={{ color: "var(--muted2)" }}>Curated by <span className="font-bold" style={{ color: "var(--fg)" }}>Vault Council</span></span>
            </div>
            <div className="relative">
              <Tile hue={220} className="min-h-[300px] w-full">
                {room && room.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={room.image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />
                ) : null}
                <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(3,6,10,0.72), rgba(3,6,10,0.2) 62%, transparent)" }} />
                <div className="relative z-10 max-w-[62%] p-6">
                  <h2 className="text-[30px] font-extrabold leading-[1.02] tracking-[-0.02em]" style={{ color: "#F3F4F5" }}>
                    {room === undefined ? "Loading…" : room ? room.title : "Room of the Night"}
                  </h2>
                  <p className="mt-3 line-clamp-4 text-[13px] leading-snug" style={{ color: "rgba(240,241,242,0.78)" }}>
                    {room === undefined ? "" : (room && room.desc) ? room.desc : "A nightly spotlight on legendary pieces that moved the market, broke records, or defined the culture. No featured room tonight."}
                  </p>
                  {room && room.linkUrl ? (
                    <a href={room.linkUrl} target="_blank" rel="noopener noreferrer" className="vltd-primary-button mt-4 inline-flex rounded-[6px] px-4 py-2 text-[12px] font-black">{room.linkLabel}</a>
                  ) : (
                    <button type="button" className="vltd-primary-button mt-4 inline-flex rounded-[6px] px-4 py-2 text-[12px] font-black">View Room</button>
                  )}
                </div>
              </Tile>
            </div>
            {room && room.tags.length > 0 ? (
              <div className="flex flex-wrap gap-2 px-5 py-3" style={{ borderTop: "1px solid var(--border)" }}>
                {room.tags.map((t) => (
                  <span key={t} className="rounded-[4px] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em]" style={{ background: "var(--pill)", color: "var(--muted)" }}>{titleCase(t.replace(/_/g, " "))}</span>
                ))}
              </div>
            ) : null}
          </section>

          <section className="rounded-[8px]" style={CARD}>
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
              <Label>New Members</Label>
              <More href="/discover" />
            </div>
            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
              {members === null ? (
                <div className="col-span-full py-6 text-center text-[12px]" style={{ color: "var(--muted2)" }}>Loading…</div>
              ) : members.length === 0 ? (
                <div className="col-span-full py-6 text-center text-[12px]" style={{ color: "var(--muted2)" }}>No new members yet.</div>
              ) : (
                members.map((m, i) => (
                  <Link key={m.username || `${m.name}-${i}`} href={m.username ? `/u/${m.username}` : "/discover"} className="flex flex-col items-center gap-2 rounded-[7px] p-3 text-center transition hover:-translate-y-0.5" style={{ border: "1px solid var(--border)" }}>
                    <Avatar name={m.name} size={44} src={m.src} />
                    <div className="text-[12px] font-bold leading-tight">{m.name}</div>
                    <div className="text-[10px]" style={{ color: "var(--muted2)" }}>{m.joined}</div>
                    <span className="rounded-[4px] px-2 py-0.5 text-[10px] font-black" style={{ background: "rgba(79,211,238,0.10)", color: CYAN, border: `1px solid rgba(79,211,238,0.35)` }}>New</span>
                  </Link>
                ))
              )}
            </div>
          </section>
        </div>

        {/* ── RIGHT: MVP + Signals + Drops + Universe Tables ── */}
        <div className="flex flex-col gap-4">
          <section className="rounded-[8px]" style={CARD}>
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
              <span className="flex items-center gap-1.5"><Label>MVP Table</Label><Info /></span>
              <span className="text-[11px]" style={{ color: "var(--muted2)" }}>By items</span>
            </div>
            {mvp === null ? (
              <div className="px-4 py-6 text-center text-[12px]" style={{ color: "var(--muted2)" }}>Loading…</div>
            ) : mvp.length === 0 ? (
              <div className="px-4 py-6 text-center text-[12px]" style={{ color: "var(--muted2)" }}>No ranked collectors yet.</div>
            ) : (
              <ul>
                {mvp.map((m, i) => (
                  <li key={m.profile_id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <Link href={m.username ? `/u/${m.username}` : "/discover"} className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-[color:var(--table-row-hover)]">
                      <span className="grid h-6 w-6 place-items-center rounded-[5px] text-[11px] font-black" style={{ background: i < 3 ? "linear-gradient(165deg,#EDEFF1,#A8AEB4)" : "var(--pill)", color: i < 3 ? "#0B0C0E" : "var(--muted)" }}>{i + 1}</span>
                      <Avatar name={m.name} size={26} src={resolveAvatarSrc({ avatarEmoji: m.avatarEmoji, profileId: m.profile_id, displayName: m.name })} />
                      <span className="min-w-0 flex-1 truncate text-[13px] font-bold">{m.name}</span>
                      <span className="text-[13px] font-black" style={{ color: CYAN }}>{fmt(m.items)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/discover" className="block w-full px-4 py-3 text-left text-[12px] font-bold" style={{ color: CYAN }}>View full leaderboard →</Link>
          </section>

          <section className="rounded-[8px]" style={CARD}>
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
              <span className="flex items-center gap-1.5"><Label>Collector Signals</Label><Info /></span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold" style={{ color: GREEN }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: GREEN }} />Live</span>
            </div>
            <div className="grid grid-cols-2 gap-px" style={{ background: "var(--border)" }}>
              {[
                { label: "Market Pulse (7D)", value: signals ? `${signals.pulse >= 0 ? "+" : ""}${signals.pulse}%` : "—", tone: signals && signals.pulse < 0 ? "#E05252" : GREEN, chart: <Spark color={signals && signals.pulse < 0 ? "#E05252" : GREEN} /> },
                { label: "Volume (7D)", value: signals ? money(signals.volume) : "—", tone: CYAN, chart: <Bars /> },
                { label: "Active Listings", value: signals ? fmt(signals.listings) : "—", tone: "var(--fg)", chart: null },
                { label: "Sales (7D)", value: signals ? fmt(signals.sales) : "—", tone: CYAN, chart: null },
              ].map((s) => (
                <div key={s.label} className="p-3.5" style={{ background: "var(--surface)" }}>
                  <div className="text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--muted2)" }}>{s.label}</div>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <span className="text-[18px] font-black" style={{ color: s.tone }}>{s.value}</span>
                    {s.chart}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[8px]" style={CARD}>
            <div className="flex items-center gap-1.5 px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}><Label>Upcoming Lounge Drops</Label><Info /></div>
            {drops === null ? (
              <div className="px-4 py-6 text-center text-[12px]" style={{ color: "var(--muted2)" }}>Loading…</div>
            ) : drops.length === 0 ? (
              <div className="px-4 py-6 text-center text-[12px]" style={{ color: "var(--muted2)" }}>No upcoming drops.</div>
            ) : (
              <ul>
                {drops.map((d) => (
                  <li key={d.name + d.date} style={{ borderBottom: "1px solid var(--border)" }}>
                    <Link href="/events" className="flex items-center gap-3 px-4 py-3 transition hover:bg-[color:var(--table-row-hover)]">
                      <Tile hue={40} className="h-11 w-11 shrink-0 rounded-[6px]" />
                      <div className="min-w-0 flex-1"><p className="truncate text-[12.5px] font-bold">{d.name}</p></div>
                      <div className="shrink-0 text-right"><div className="text-[11px] font-black" style={{ color: CYAN }}>{d.date}</div><div className="text-[10px]" style={{ color: "var(--muted2)" }}>{d.time}</div></div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/events" className="block w-full px-4 py-3 text-left text-[12px] font-bold" style={{ color: CYAN }}>View all drops →</Link>
          </section>

          <section className="rounded-[8px]" style={CARD}>
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
              <Label>Universe Tables</Label>
              <More href="/discover" />
            </div>
            {universes === null ? (
              <div className="px-4 py-6 text-center text-[12px]" style={{ color: "var(--muted2)" }}>Loading…</div>
            ) : universes.length === 0 ? (
              <div className="px-4 py-6 text-center text-[12px]" style={{ color: "var(--muted2)" }}>No universes yet.</div>
            ) : (
              <ul>
                {universes.map((u) => (
                  <li key={u.subject} style={{ borderBottom: "1px solid var(--border)" }}>
                    <Link href={`/registry/${encodeURIComponent(u.raw)}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[12.5px] transition hover:bg-[color:var(--table-row-hover)]">
                      <span className="flex items-center gap-2.5"><Avatar name={u.subject} size={22} /><span className="font-bold">{u.subject}</span></span>
                      <span className="flex items-center gap-2" style={{ color: "var(--muted)" }}>{fmt(u.collectors)} collectors<span className="h-1.5 w-1.5 rounded-full" style={{ background: GREEN }} /></span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
