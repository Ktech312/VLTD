"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Glyph, type GlyphName } from "@/components/ui/Glyph";
import { loadActivityEvents, syncActivityEventsFromSupabase, type ActivityEventRecord } from "@/lib/activityEvents";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { isUniverseKey, type UniverseKey, UNIVERSE_LABEL } from "@/lib/taxonomy";

const gold = "#D9A23A";
const gold2 = "#F1C15B";
const cream = "#F4E8CF";
const cyan = "#39D8EF";
const green = "#55D78D";
const red = "#FF695D";
const muted = "rgba(206,190,152,0.76)";
const quiet = "rgba(206,190,152,0.52)";
const panel = "rgba(3, 12, 16, 0.90)";
const panel2 = "rgba(8, 20, 26, 0.78)";
const border = "rgba(217,162,58,0.30)";
const borderSoft = "rgba(217,162,58,0.16)";
const serif = "var(--font-serif, 'Cormorant Garamond', Georgia, serif)";

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
};

type PublicGallery = {
  id: string;
  title: string;
  description: string | null;
  cover_image: string | null;
  analytics_views: number;
  item_count: number;
  universeKey: UniverseKey;
  itemIds: string[];
};

type MVPEntry = {
  profile_id: string;
  display_name: string;
  item_count: number;
};

type UniverseMVP = {
  subject: string;
  entries: MVPEntry[];
};

const universeThumb: Record<UniverseKey, string> = {
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

function fmtNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value || 0);
}

function timeAgo(timestamp: number) {
  if (!timestamp) return "recently";
  const diff = Date.now() - timestamp;
  const minutes = Math.max(1, Math.round(diff / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function normalize(value: unknown) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function inferUniverse(row: Pick<PublicGallery, "title" | "description">): UniverseKey {
  const text = normalize(`${row.title} ${row.description ?? ""}`);
  if (/(pokemon|magic|tcg|trading card|slab|foil)/.test(text)) return "TCG";
  if (/(sports|rookie|jersey|baseball|basketball|football|soccer|hockey)/.test(text)) return "SPORTS";
  if (/(vinyl|album|music|record|guitar|instrument)/.test(text)) return "MUSIC";
  if (/(watch|jewelry|apparel|streetwear|luxury)/.test(text)) return "JEWELRY_APPAREL";
  if (/(game|console|nintendo|playstation|xbox|arcade)/.test(text)) return "GAMES";
  if (/(comic|marvel|figure|toy|manga|funko|prop|statue)/.test(text)) return "POP_CULTURE";
  if (/(plant|botany|garden|handmade|woodwork|ceramic)/.test(text)) return "BUILT_BOTANY";
  if (/(car|automotive|vehicle|garage)/.test(text)) return "AUTOMOTIVE";
  if (/(art|painting|poster|print)/.test(text)) return "ART";
  return "MISC";
}

function parseGallery(row: Record<string, unknown>): PublicGallery {
  const layout = row.layout && typeof row.layout === "object" ? (row.layout as Record<string, unknown>) : null;
  const rawItemIds = Array.isArray(layout?.itemIds) ? layout.itemIds : [];
  const gallery = {
    id: String(row.id),
    title: String(row.title ?? "Untitled room"),
    description: typeof row.description === "string" ? row.description : null,
    cover_image: typeof row.cover_image === "string" && row.cover_image ? row.cover_image : null,
    analytics_views: typeof row.analytics_views === "number" ? row.analytics_views : 0,
    item_count: rawItemIds.filter((id): id is string => typeof id === "string").length,
    universeKey: "MISC" as UniverseKey,
    itemIds: rawItemIds.filter((id): id is string => typeof id === "string"),
  };
  gallery.universeKey = inferUniverse(gallery);
  return gallery;
}

function typeGlyph(type: Spotlight["type"]): GlyphName {
  if (type === "artist") return "palette";
  if (type === "brand") return "building";
  return "users";
}

function activityGlyph(kind: ActivityEventRecord["kind"]): GlyphName {
  if (kind === "valued") return "chart";
  if (kind === "sold") return "tag";
  if (kind === "comment") return "message";
  if (kind === "exhibition") return "building";
  if (kind === "insurance") return "shield";
  if (kind === "share") return "share";
  return "box";
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={`relative overflow-hidden border ${className}`}
      style={{
        borderColor: border,
        background: `linear-gradient(145deg, ${panel}, rgba(1,7,10,0.98))`,
        boxShadow: "0 24px 80px rgba(0,0,0,0.46), inset 0 1px 0 rgba(255,255,255,0.035)",
      }}
    >
      {children}
    </section>
  );
}

function ActionButton({
  href,
  icon,
  label,
  purpose,
  primary = false,
}: {
  href: string;
  icon: GlyphName;
  label: string;
  purpose: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      title={purpose}
      className="inline-flex min-h-10 items-center gap-2 rounded-[6px] border px-4 py-2 text-sm font-black transition hover:translate-y-[-1px]"
      style={{
        borderColor: primary ? "rgba(241,193,91,0.72)" : border,
        background: primary
          ? "linear-gradient(135deg, #8D641C, #F1C15B 54%, #B77C21)"
          : "rgba(255,255,255,0.035)",
        color: primary ? "#080602" : cream,
        boxShadow: primary ? "0 12px 36px rgba(217,162,58,0.22)" : "none",
      }}
    >
      <Glyph name={icon} size={16} />
      {label}
    </Link>
  );
}

function EmptyState({ icon, title, copy }: { icon: GlyphName; title: string; copy: string }) {
  return (
    <div className="flex min-h-[132px] items-center gap-4 rounded-[7px] border p-5" style={{ borderColor: borderSoft, background: panel2 }}>
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[6px] border" style={{ borderColor: border, color: gold }}>
        <Glyph name={icon} size={24} />
      </div>
      <div>
        <div className="font-black" style={{ color: cream }}>{title}</div>
        <p className="mt-1 text-sm leading-5" style={{ color: muted }}>{copy}</p>
      </div>
    </div>
  );
}

function GalleryImage({ gallery, className = "" }: { gallery: PublicGallery; className?: string }) {
  const src = gallery.cover_image || universeThumb[gallery.universeKey];
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={gallery.title} className={`h-full w-full object-cover ${className}`} />
  );
}

export default function LoungePreviewPage() {
  const [spotlights, setSpotlights] = useState<Spotlight[]>([]);
  const [galleries, setGalleries] = useState<PublicGallery[]>([]);
  const [mvps, setMvps] = useState<UniverseMVP[]>([]);
  const [activity, setActivity] = useState<ActivityEventRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function load() {
      setActivity(loadActivityEvents().slice(0, 8));

      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        setLoading(false);
        return;
      }

      const [events, spotlightResult, galleryResult, subjectsResult] = await Promise.all([
        syncActivityEventsFromSupabase(),
        supabase
          .from("spotlights")
          .select("id,type,name,tagline,bio,image_url,universe_tags,link_url,link_label,is_featured,sort_order")
          .eq("enabled", true)
          .order("is_featured", { ascending: false })
          .order("sort_order", { ascending: true })
          .limit(6),
        supabase
          .from("galleries")
          .select("id,title,description,cover_image,analytics_views,layout")
          .eq("visibility", "PUBLIC")
          .eq("state", "ACTIVE")
          .order("analytics_views", { ascending: false })
          .limit(6),
        supabase.rpc("get_top_subjects", { p_limit: 4 }),
      ]);

      const nextMvps: UniverseMVP[] = [];
      const subjects = (subjectsResult.data ?? []) as Array<{ subject: string }>;
      for (const subject of subjects) {
        const { data } = await supabase.rpc("get_subject_leaderboard", {
          subject_name: subject.subject,
          p_limit: 4,
        });
        const entries = ((data ?? []) as Array<Record<string, unknown>>).map((entry) => ({
          profile_id: String(entry.profile_id ?? ""),
          display_name: String(entry.display_name ?? "Collector"),
          item_count: Number(entry.item_count ?? 0),
        }));
        if (entries.length) nextMvps.push({ subject: subject.subject, entries });
      }

      if (!alive) return;
      setActivity(events.slice(0, 8));
      setSpotlights((spotlightResult.data ?? []) as Spotlight[]);
      setGalleries((galleryResult.data ?? []).map((row) => parseGallery(row as Record<string, unknown>)));
      setMvps(nextMvps);
      setLoading(false);
    }

    void load();
    return () => {
      alive = false;
    };
  }, []);

  const featuredRoom = galleries[0] ?? null;
  const roomStats = useMemo(() => {
    return {
      rooms: galleries.length,
      items: galleries.reduce((sum, gallery) => sum + gallery.item_count, 0),
      views: galleries.reduce((sum, gallery) => sum + gallery.analytics_views, 0),
    };
  }, [galleries]);
  const mvpRows = mvps.flatMap((board) => board.entries.map((entry) => ({ ...entry, subject: board.subject }))).slice(0, 5);
  const universeRows = (Object.keys(universeThumb) as UniverseKey[])
    .map((key) => ({
      key,
      rooms: galleries.filter((gallery) => gallery.universeKey === key).length,
    }))
    .filter((row) => row.rooms > 0)
    .slice(0, 6);

  return (
    <main
      className="min-h-screen px-4 pb-12 pt-6 text-white sm:px-6 lg:px-8"
      style={{
        background:
          "radial-gradient(circle at 10% 0%, rgba(36,82,99,0.18), transparent 28%), radial-gradient(circle at 98% 18%, rgba(217,162,58,0.08), transparent 32%), linear-gradient(135deg, #000407 0%, #041018 46%, #010506 100%)",
      }}
    >
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-5 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.28em]" style={{ color: gold }}>
              Community Command Room
            </p>
            <div className="mt-2 flex flex-wrap items-end gap-4">
              <h1 className="text-[54px] font-semibold leading-[0.88] md:text-[72px]" style={{ color: cream, fontFamily: serif }}>
                VLT Lounge
              </h1>
              <p className="max-w-xl pb-2 text-sm leading-6" style={{ color: muted }}>
                Live collector talk, featured rooms, trusted answers, and universe tables. This is not Discover; this is where the community gathers.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton href="/notifications" icon="bell" label="Open Alerts" purpose="Routes mail/messages/notifications into the existing Alerts system." />
            <ActionButton href="/community-board" icon="message" label="Ask the Lounge" purpose="Future post drawer for collector questions, item help, and market chatter." />
            <ActionButton href="/admin/spotlights" icon="palette" label="Post Update" purpose="Admin/creator entry point until native Lounge posting is built." primary />
          </div>
        </header>

        <section className="grid gap-4 xl:grid-cols-[0.88fr_1.05fr_0.72fr]">
          <Panel className="rounded-[8px] p-5">
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: borderSoft }}>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.28em]" style={{ color: gold }}>Lounge Live</p>
                <p className="mt-1 text-xs" style={{ color: quiet }}>Real activity plus future discussions and item chatter.</p>
              </div>
              <span className="rounded-[5px] border px-2 py-1 text-xs font-black" style={{ borderColor: borderSoft, color: green }}>
                {activity.length} live
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {activity.length ? (
                activity.slice(0, 5).map((event) => (
                  <Link
                    key={event.id}
                    href={event.href || "/activity"}
                    className="grid grid-cols-[42px_1fr_auto] gap-3 rounded-[7px] border p-3 transition hover:brightness-110"
                    style={{ borderColor: borderSoft, background: "rgba(255,255,255,0.028)" }}
                    title="Opens the source item, exhibition, or activity record."
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-[6px] border" style={{ borderColor: border, color: gold }}>
                      <Glyph name={activityGlyph(event.kind)} size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="line-clamp-1 text-sm font-black" style={{ color: cream }}>{event.title}</div>
                      <div className="line-clamp-1 text-xs" style={{ color: muted }}>{event.subtitle || event.detail || event.kind}</div>
                    </div>
                    <div className="text-right text-[11px]" style={{ color: quiet }}>{timeAgo(event.timestamp)}</div>
                  </Link>
                ))
              ) : (
                <EmptyState
                  icon="message"
                  title="No live Lounge activity yet"
                  copy="When activity_events and Lounge posts exist, this becomes the live feed. No fake posts are being shown."
                />
              )}
            </div>
          </Panel>

          <Panel className="min-h-[510px] rounded-[8px]">
            <div className="absolute inset-0">
              {featuredRoom ? (
                <GalleryImage gallery={featuredRoom} className="opacity-78" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src="/brand/vltd-command-vault-door.png" alt="" className="h-full w-full object-cover opacity-76" />
              )}
              <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.86),rgba(0,0,0,0.32)_55%,rgba(0,0,0,0.72))]" />
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black to-transparent" />
            </div>
            <div className="relative flex min-h-[510px] flex-col justify-between p-6">
              <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: borderSoft }}>
                <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em]" style={{ color: gold }}>
                  <Glyph name="exhibition" size={16} />
                  Room of the Night
                </div>
                <span className="text-xs font-bold" style={{ color: quiet }}>Admin curated first, auto suggested later</span>
              </div>
              <div className="max-w-[470px]">
                <h2 className="text-[48px] font-semibold leading-[0.95]" style={{ color: cream, fontFamily: serif }}>
                  {featuredRoom?.title ?? "A featured room belongs here."}
                </h2>
                <p className="mt-4 line-clamp-3 text-sm leading-6" style={{ color: muted }}>
                  {featuredRoom?.description || "This panel spotlights one public exhibition or club room without turning Lounge into another Discover grid."}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {featuredRoom ? (
                    <ActionButton href={`/museum/${featuredRoom.id}`} icon="eye" label="View Room" purpose="Opens the featured public room." primary />
                  ) : (
                    <ActionButton href="/admin/spotlights" icon="star" label="Choose Feature" purpose="Admin chooses the featured Lounge room until auto suggestions exist." primary />
                  )}
                  <ActionButton href="/discover" icon="search" label="Find Rooms" purpose="Sends users to Discover when they want to browse, keeping Lounge focused." />
                </div>
              </div>
              <div className="grid grid-cols-3 border" style={{ borderColor: borderSoft }}>
                {[
                  ["Rooms", roomStats.rooms],
                  ["Items", roomStats.items],
                  ["Views", roomStats.views],
                ].map(([label, value]) => (
                  <div key={label} className="border-r p-3 last:border-r-0" style={{ borderColor: borderSoft }}>
                    <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: quiet }}>{label}</div>
                    <div className="mt-1 text-2xl font-black" style={{ color: cyan }}>{fmtNumber(Number(value))}</div>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          <div className="grid gap-4">
            <Panel className="rounded-[8px] p-5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-black uppercase tracking-[0.28em]" style={{ color: gold }}>MVP Table</p>
                <span className="text-xs" style={{ color: quiet }}>Rank by helpful activity</span>
              </div>
              <div className="mt-4 space-y-2">
                {mvpRows.length ? (
                  mvpRows.map((entry, index) => (
                    <Link
                      key={`${entry.subject}-${entry.profile_id}-${index}`}
                      href={`/community-board/${encodeURIComponent(entry.subject)}`}
                      className="grid grid-cols-[34px_1fr_auto] items-center gap-3 rounded-[6px] border px-3 py-2"
                      style={{ borderColor: borderSoft, background: "rgba(255,255,255,0.026)" }}
                      title="Opens the universe leaderboard this ranking came from."
                    >
                      <span className="text-lg font-black" style={{ color: index < 3 ? gold2 : muted }}>{index + 1}</span>
                      <span className="min-w-0 truncate text-sm font-black" style={{ color: cream }}>{entry.display_name}</span>
                      <span className="text-sm font-black" style={{ color: cyan }}>{fmtNumber(entry.item_count)}</span>
                    </Link>
                  ))
                ) : (
                  <EmptyState icon="trophy" title="No MVP data yet" copy="This will use rank events and existing universe leaderboards. No fake rankings shown." />
                )}
              </div>
            </Panel>

            <Panel className="rounded-[8px] p-5">
              <p className="text-[11px] font-black uppercase tracking-[0.28em]" style={{ color: gold }}>Collector Signals</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {[
                  ["Activity", activity.length, green, "Real activity rows loaded for Lounge."],
                  ["Spotlights", spotlights.length, cyan, "Approved spotlights available."],
                  ["Rooms", galleries.length, cyan, "Public exhibitions available."],
                  ["Clubs", 0, red, "Discord/native clubs need backend config."],
                ].map(([label, value, color, title]) => (
                  <div key={String(label)} title={String(title)} className="rounded-[6px] border p-3" style={{ borderColor: borderSoft, background: panel2 }}>
                    <div className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: quiet }}>{label}</div>
                    <div className="mt-1 text-2xl font-black" style={{ color: String(color) }}>{String(value)}</div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-[0.8fr_0.62fr_0.58fr]">
          <Panel className="rounded-[8px] p-5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-black uppercase tracking-[0.28em]" style={{ color: gold }}>Hot Threads</p>
              <span className="text-xs" style={{ color: quiet }}>Needs lounge_posts</span>
            </div>
            <div className="mt-4 space-y-2">
              <EmptyState
                icon="message"
                title="Threads are not wired yet"
                copy="This area should show real discussions, Q&A, and item chatter once lounge_posts and comments are added."
              />
            </div>
          </Panel>

          <Panel className="rounded-[8px] p-5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-black uppercase tracking-[0.28em]" style={{ color: gold }}>Possible Clubs</p>
              <Link href="/notifications" className="text-xs font-bold" style={{ color: gold }} title="Club mail and mentions should surface through Alerts.">
                Alerts linked
              </Link>
            </div>
            <div className="mt-4 rounded-[7px] border p-4" style={{ borderColor: borderSoft, background: panel2 }}>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[6px] border" style={{ borderColor: border, color: gold }}>
                  <Glyph name="users" size={22} />
                </div>
                <div>
                  <div className="font-black" style={{ color: cream }}>Discord bridge</div>
                  <p className="text-xs leading-5" style={{ color: muted }}>Optional external club link now; native VLTD groups later.</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <ActionButton href="/more" icon="share" label="Configure" purpose="Future admin panel for Discord invite URL and club visibility." />
                <ActionButton href="/community-board" icon="users" label="Club Lobby" purpose="Future native club index for universe-specific groups." />
              </div>
            </div>
          </Panel>

          <Panel className="rounded-[8px] p-5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-black uppercase tracking-[0.28em]" style={{ color: gold }}>Universe Tables</p>
              <Link href="/community-board" className="text-xs font-bold" style={{ color: gold }}>View boards</Link>
            </div>
            <div className="mt-4 space-y-2">
              {universeRows.length ? (
                universeRows.map((row) => (
                  <Link
                    key={row.key}
                    href={`/community-board/${encodeURIComponent(row.key)}`}
                    className="grid grid-cols-[42px_1fr_auto] items-center gap-3 rounded-[6px] border px-3 py-2"
                    style={{ borderColor: borderSoft, background: "rgba(255,255,255,0.026)" }}
                    title="Opens the universe board for collectors in this category."
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={universeThumb[row.key]} alt="" className="h-10 w-10 rounded-[5px] object-cover" />
                    <span className="min-w-0 truncate text-sm font-black" style={{ color: cream }}>{UNIVERSE_LABEL[row.key]}</span>
                    <span className="text-xs font-black" style={{ color: cyan }}>{row.rooms}</span>
                  </Link>
                ))
              ) : (
                <EmptyState icon="sofa" title="No active universe tables" copy="Tables populate from public room/category activity and future Lounge posts." />
              )}
            </div>
          </Panel>
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-[1fr_0.9fr]">
          <Panel className="rounded-[8px] p-5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-black uppercase tracking-[0.28em]" style={{ color: gold }}>Spotlight Bench</p>
              <Link href="/admin/spotlights" className="text-xs font-bold" style={{ color: gold }}>Manage spotlights</Link>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {spotlights.length ? (
                spotlights.slice(0, 4).map((spotlight) => (
                  <a
                    key={spotlight.id}
                    href={spotlight.link_url || "#"}
                    target={spotlight.link_url ? "_blank" : undefined}
                    rel="noopener noreferrer"
                    className="grid grid-cols-[58px_1fr] gap-3 rounded-[7px] border p-3"
                    style={{ borderColor: borderSoft, background: panel2 }}
                    title="Approved collector, artist, or brand spotlight."
                  >
                    <div className="flex h-[58px] w-[58px] items-center justify-center overflow-hidden rounded-[6px] border" style={{ borderColor: border, color: gold }}>
                      {spotlight.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={spotlight.image_url} alt={spotlight.name} className="h-full w-full object-cover" />
                      ) : (
                        <Glyph name={typeGlyph(spotlight.type)} size={24} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-black" style={{ color: cream }}>{spotlight.name}</div>
                      <p className="mt-1 line-clamp-2 text-xs leading-5" style={{ color: muted }}>{spotlight.tagline || spotlight.bio || spotlight.type}</p>
                    </div>
                  </a>
                ))
              ) : (
                <EmptyState icon="palette" title="No spotlights approved yet" copy="Admin-created spotlight records will appear here. This stays empty until real records exist." />
              )}
            </div>
          </Panel>

          <Panel className="rounded-[8px] p-5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-black uppercase tracking-[0.28em]" style={{ color: gold }}>Upcoming Lounge Drops</p>
              <span className="text-xs" style={{ color: quiet }}>Needs event source</span>
            </div>
            <div className="mt-4">
              <EmptyState
                icon="clock"
                title="Drops should come from Events"
                copy="Future rows should be SerpApi/admin-approved events, Discord meetups, auctions, or community challenges. No fake drops here."
              />
            </div>
          </Panel>
        </section>
      </div>
    </main>
  );
}
