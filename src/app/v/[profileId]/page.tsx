"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Glyph, universeGlyphName } from "@/components/ui/Glyph";

import VaultMuseumView from "@/components/VaultMuseumView";
import {
  fetchPublicProfile,
  fetchPublicVaultItems,
  fetchPublicGalleriesForProfile,
  type PublicProfile,
  type PublicGallery,
} from "@/lib/publicProfile";
import { getPrimaryImageUrl, type VaultItem } from "@/lib/vaultModel";
import { getFollowerCount, isFollowing } from "@/lib/follows";
import { FollowButton } from "@/components/social/FollowButton";
import OnlineDot from "@/components/OnlineDot";
import { fetchLastSeen } from "@/lib/presence";

const ACTIVE_PROFILE_KEY = "vltd_active_profile_id_v1";

function getActiveProfileId(): string {
  if (typeof window === "undefined") return "";
  try {
    return String(window.localStorage.getItem(ACTIVE_PROFILE_KEY) ?? "").trim();
  } catch {
    return "";
  }
}

// ─── helpers ──────────────────────────────────────────────────────────────────
function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function copyToClipboard(text: string) {
  void navigator.clipboard.writeText(text);
}

function getUniqueUniverses(items: VaultItem[]) {
  const seen = new Set<string>();
  for (const item of items) if (item.universe) seen.add(item.universe);
  return [...seen].sort();
}

function getTopSubjects(items: VaultItem[], limit = 5) {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const s = item.subject ?? item.category ?? item.universe;
    if (s) counts[s] = (counts[s] ?? 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([subject, count]) => ({ subject, count }));
}

function getGradedCount(items: VaultItem[]) {
  return items.filter((i) => i.grade).length;
}

function getTopGrade(items: VaultItem[]) {
  const graded = items.filter((i) => i.grade);
  if (!graded.length) return null;
  const numeric = graded
    .map((i) => parseFloat(i.grade ?? "0"))
    .filter((n) => !isNaN(n));
  if (!numeric.length) return null;
  return Math.max(...numeric);
}

// ─── Stat pill ────────────────────────────────────────────────────────────────
function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-4">
      <span className="text-xl font-bold tabular-nums">{value}</span>
      <span className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">{label}</span>
    </div>
  );
}

// ─── Universe chip ────────────────────────────────────────────────────────────
function UniverseChip({ universe, count }: { universe: string; count: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--pill)] px-3 py-1.5 text-xs font-semibold ring-1 ring-[color:var(--border)]">
      <Glyph name={universeGlyphName(universe)} size={13} />
      <span>{universe}</span>
      <span className="opacity-50">·</span>
      <span className="opacity-70">{count}</span>
    </span>
  );
}

// ─── Featured item card ────────────────────────────────────────────────────────
function FeaturedCard({ item, onClick }: { item: VaultItem; onClick?: (item: VaultItem) => void }) {
  const imageUrl = getPrimaryImageUrl(item);
  return (
    <button
      type="button"
      onClick={onClick ? () => onClick(item) : undefined}
      className="block w-full text-left relative overflow-hidden rounded-2xl bg-[color:var(--surface)] ring-1 ring-[color:var(--border)] transition hover:-translate-y-0.5"
    >
      <div className="aspect-[3/4] w-full overflow-hidden bg-[color:var(--pill)]">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={item.title ?? ""}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full items-center justify-center opacity-20"><Glyph name="frame" size={40} /></div>
        )}
      </div>
      <div className="p-3">
        <div className="truncate text-sm font-semibold">{item.title ?? "Untitled"}</div>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[color:var(--muted)]">
          <span>{item.universe ?? item.category ?? ""}</span>
          {item.grade && (
            <>
              <span>·</span>
              <span className="font-semibold text-[color:var(--theme-gold,#C8CDD2)]">
                Grade {item.grade}
              </span>
            </>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Item detail modal — single item, or a filtered list (e.g. "Collects Most") ──
function ProfileItemModal({
  singleItem,
  listItems,
  listTitle,
  onClose,
  onSelectItem,
}: {
  singleItem?: VaultItem | null;
  listItems?: VaultItem[];
  listTitle?: string;
  onClose: () => void;
  onSelectItem?: (item: VaultItem) => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, []);

  const overlay = (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9100,
        background: "rgba(5,8,14,0.86)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: singleItem ? 420 : 560,
          maxHeight: "85vh",
          overflowY: "auto",
          borderRadius: 24,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          padding: 20,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{ position: "absolute", right: 14, top: 14, width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer", background: "var(--pill)", color: "var(--fg)" }}
        >
          <svg viewBox="0 0 20 20" fill="none" style={{ width: 13, height: 13 }}>
            <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>

        {singleItem ? (
          <>
            <div style={{ aspectRatio: "3 / 4", width: "100%", maxWidth: 260, margin: "0 auto", borderRadius: 16, overflow: "hidden", background: "var(--pill)" }}>
              {getPrimaryImageUrl(singleItem) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={getPrimaryImageUrl(singleItem)} alt={singleItem.title ?? ""} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              ) : (
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.25 }}><Glyph name="frame" size={40} /></div>
              )}
            </div>
            <div style={{ marginTop: 14, textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--fg)" }}>{singleItem.title ?? "Untitled"}</div>
              <div style={{ marginTop: 4, fontSize: 12, color: "var(--muted)" }}>
                {[singleItem.subtitle, singleItem.number, singleItem.grade ? `Grade ${singleItem.grade}` : null].filter(Boolean).join(" · ") || (singleItem.universe ?? singleItem.category ?? "")}
              </div>
              {typeof singleItem.currentValue === "number" && singleItem.currentValue > 0 && (
                <div style={{ marginTop: 8, display: "inline-flex", borderRadius: 999, padding: "5px 14px", fontSize: 13, fontWeight: 700, background: "var(--pill)", color: "var(--theme-gold, #C8CDD2)" }}>
                  {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(singleItem.currentValue)}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--fg)", paddingRight: 30 }}>
              {listTitle}
            </div>
            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {(listItems ?? []).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectItem?.(item)}
                  style={{ borderRadius: 12, overflow: "hidden", background: "var(--pill)", border: "1px solid var(--border)", padding: 0, cursor: "pointer", textAlign: "left" }}
                >
                  <div style={{ aspectRatio: "3 / 4", background: "var(--surface)" }}>
                    {getPrimaryImageUrl(item) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={getPrimaryImageUrl(item)} alt={item.title ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    ) : null}
                  </div>
                  <div style={{ padding: "6px 7px", fontSize: 10, fontWeight: 600, color: "var(--fg)", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, lineHeight: 1.25 }}>
                    {item.title ?? "Untitled"}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(overlay, document.body);
}

// ─── Gallery card ─────────────────────────────────────────────────────────────
function GalleryCard({ gallery, profileId }: { gallery: PublicGallery; profileId: string }) {
  return (
    <Link
      href={`/museum/${gallery.id}/guest`}
      className="group flex flex-col overflow-hidden rounded-2xl bg-[color:var(--surface)] ring-1 ring-[color:var(--border)] transition hover:-translate-y-0.5"
    >
      <div className="relative h-[120px] overflow-hidden bg-[color:var(--pill)]">
        {gallery.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={gallery.coverImage} alt={gallery.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center opacity-20"><Glyph name="building" size={28} /></div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        {gallery.views > 0 && (
          <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white/80">
            <Glyph name="eye" size={11} />
            {gallery.views.toLocaleString()}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <div className="truncate text-sm font-semibold">{gallery.title}</div>
        {gallery.description && (
          <div className="mt-1 line-clamp-2 text-[11px] leading-5 text-[color:var(--muted)]">{gallery.description}</div>
        )}
        <div className="mt-auto pt-2 text-[10px] text-[color:var(--muted2)] uppercase tracking-[0.14em]">
          {gallery.itemCount > 0 ? `${gallery.itemCount} items` : "Exhibition"}
          {gallery.visibility === "INVITE" && " · Invite only"}
        </div>
      </div>
    </Link>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function PublicVaultPage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = use(params);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [galleries, setGalleries] = useState<PublicGallery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [selectedItem, setSelectedItem] = useState<VaultItem | null>(null);
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null);
  const [viewerProfileId, setViewerProfileId] = useState("");
  const [followerCount, setFollowerCount] = useState(0);
  const [viewerFollowing, setViewerFollowing] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);

  useEffect(() => {
    setViewerProfileId(getActiveProfileId());
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const viewer = getActiveProfileId();
        const [nextProfile, nextItems, nextGalleries, nextFollowerCount, nextViewerFollowing, nextLastSeen] = await Promise.all([
          fetchPublicProfile(profileId),
          fetchPublicVaultItems(profileId),
          fetchPublicGalleriesForProfile(profileId),
          getFollowerCount(profileId),
          viewer ? isFollowing(viewer, profileId) : Promise.resolve(false),
          fetchLastSeen(profileId),
        ]);
        if (!active) return;
        setProfile(nextProfile);
        setItems(nextItems);
        setGalleries(nextGalleries);
        setFollowerCount(nextFollowerCount);
        setViewerFollowing(nextViewerFollowing);
        setLastSeen(nextLastSeen);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Could not load public vault.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [profileId]);

  const displayName = profile?.displayName ?? "Collector";
  const avatarEmoji = profile?.avatarEmoji ?? "🗝️";
  const avatarUrl = profile?.avatarUrl ?? "";
  const bio = profile?.bio ?? "";

  const universes = useMemo(() => getUniqueUniverses(items), [items]);
  const universeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of items) if (item.universe) counts[item.universe] = (counts[item.universe] ?? 0) + 1;
    return counts;
  }, [items]);
  const topSubjects = useMemo(() => getTopSubjects(items), [items]);
  const gradedCount = useMemo(() => getGradedCount(items), [items]);
  const topGrade = useMemo(() => getTopGrade(items), [items]);

  // Featured = graded items first, then by createdAt desc, take up to 4
  const featuredItems = useMemo(() =>
    [...items]
      .sort((a, b) => {
        const aGrade = a.grade ? 1 : 0;
        const bGrade = b.grade ? 1 : 0;
        if (bGrade !== aGrade) return bGrade - aGrade;
        return Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0);
      })
      .slice(0, 4),
    [items]
  );

  function handleCopyLink() {
    copyToClipboard(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Loading ──
  if (loading) {
    return (
      <main className="bg-[color:var(--bg)] text-[color:var(--fg)]">
        <div className="flex items-center justify-center">
          <div className="text-sm text-[color:var(--muted)]">Loading vault…</div>
        </div>
      </main>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <main className="bg-[color:var(--bg)] text-[color:var(--fg)]">
        <div className="mx-auto max-w-lg px-4 py-20 text-center">
          <div className="mb-4 flex justify-center"><Glyph name="lock" size={40} /></div>
          <h1 className="text-xl font-semibold mb-2">Vault not found</h1>
          <p className="text-sm text-[color:var(--muted)] mb-6">{error}</p>
          <Link href="/" className="rounded-full bg-[color:var(--pill)] px-5 py-2 text-sm font-semibold ring-1 ring-[color:var(--border)]">
            Back to VLTD
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-[color:var(--bg)] text-[color:var(--fg)]">

      {/* ── Top nav bar ── */}
      <header className="sticky top-0 z-30 border-b border-[color:var(--border)] bg-[color:var(--surface)]/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[color:var(--pill)] text-xl ring-1 ring-[color:var(--border)] shrink-0">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              avatarEmoji
            )}
          </div>
          <span className="font-semibold text-sm truncate">{displayName}&apos;s Vault</span>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className="inline-flex h-8 items-center gap-1.5 rounded-[8px] bg-[color:var(--pill)] px-3 text-xs font-semibold ring-1 ring-[color:var(--border)]"
            >
              {copied ? "✓ Copied" : "Share"}
            </button>
            <Link
              href="/"
              className="inline-flex h-8 items-center rounded-full bg-[color:var(--pill)] px-3 text-[11px] font-bold tracking-[0.16em] text-[color:var(--theme-gold,#C8CDD2)] ring-1 ring-[color:var(--border)]"
            >
              VLTD
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4">

        {/* ── Hero ── */}
        <div className="py-8 flex flex-col items-center text-center gap-4">
          <div className="relative h-20 w-20">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-[color:var(--pill)] text-5xl ring-2 ring-[color:var(--border)] shadow-lg">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                avatarEmoji
              )}
            </div>
            <OnlineDot lastSeenAt={lastSeen} size={16} className="absolute bottom-0.5 right-0.5 ring-2 ring-[color:var(--bg)]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{displayName}</h1>
            <div className="mt-1 flex justify-center">
              <OnlineDot lastSeenAt={lastSeen} label size={8} />
            </div>
            {bio && <p className="mt-2 max-w-md text-sm leading-relaxed text-[color:var(--muted)]">{bio}</p>}
          </div>

          {viewerProfileId !== profileId && (
            <FollowButton
              viewerProfileId={viewerProfileId}
              targetProfileId={profileId}
              initialFollowing={viewerFollowing}
            />
          )}

          {/* Stats bar */}
          {(items.length > 0 || galleries.length > 0 || followerCount > 0) && (
            <div className="flex flex-wrap justify-center divide-x divide-[color:var(--border)] rounded-2xl bg-[color:var(--surface)] ring-1 ring-[color:var(--border)] overflow-hidden">
              {items.length > 0 && <Stat value={items.length} label={items.length === 1 ? "Item" : "Items"} />}
              {galleries.length > 0 && <Stat value={galleries.length} label={galleries.length === 1 ? "Exhibition" : "Exhibitions"} />}
              {universes.length > 0 && <Stat value={universes.length} label={universes.length === 1 ? "Universe" : "Universes"} />}
              {gradedCount > 0 && <Stat value={gradedCount} label="Graded" />}
              {topGrade !== null && <Stat value={topGrade} label="Top Grade" />}
              <Stat value={followerCount} label={followerCount === 1 ? "Follower" : "Followers"} />
            </div>
          )}

          {/* Universe chips */}
          {universes.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2">
              {universes.map((u) => (
                <UniverseChip key={u} universe={u} count={universeCounts[u] ?? 0} />
              ))}
            </div>
          )}
        </div>

        {/* ── Empty state ── */}
        {items.length === 0 && (
          <div className="rounded-2xl bg-[color:var(--surface)] p-10 text-center ring-1 ring-[color:var(--border)] mb-10">
            <div className="mb-3 flex justify-center"><Glyph name="box" size={36} /></div>
            <h2 className="text-lg font-semibold mb-1">Nothing public yet</h2>
            <p className="text-sm text-[color:var(--muted)] mb-5">
              {displayName} hasn&apos;t made any items public. Items are private by default.
            </p>
            <Link href="/" className="rounded-full bg-[color:var(--pill)] px-5 py-2 text-sm font-semibold ring-1 ring-[color:var(--border)]">
              Explore VLTD
            </Link>
          </div>
        )}

        {/* ── Featured items ── */}
        {featuredItems.length > 0 && (
          <section className="mb-8">
            <div className="mb-3 flex items-baseline gap-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">Featured Items</h2>
              <span className="text-[10px] text-[color:var(--muted2)]">{plural(items.length, "public item")}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {featuredItems.map((item) => (
                <FeaturedCard key={item.id} item={item} onClick={setSelectedItem} />
              ))}
            </div>
          </section>
        )}

        {/* ── Top subjects ── */}
        {topSubjects.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">Collects most</h2>
            <div className="flex flex-wrap gap-2">
              {topSubjects.map(({ subject, count }) => (
                <button
                  key={subject}
                  type="button"
                  onClick={() => setSubjectFilter(subject)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--surface)] px-4 py-2 text-sm font-medium ring-1 ring-[color:var(--border)] transition hover:ring-[color:var(--border-strong)]"
                >
                  {subject}
                  <span className="rounded-full bg-[color:var(--pill)] px-1.5 py-0.5 text-[10px] font-semibold">{count}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── Galleries ── */}
        {galleries.length > 0 && (
          <section className="mb-8">
            <div className="mb-3 flex items-baseline gap-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">Exhibitions</h2>
              <span className="text-[10px] text-[color:var(--muted2)]">{galleries.length === 1 ? "1 public exhibition" : `${galleries.length} public exhibitions`}</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {galleries.map((gallery) => (
                <GalleryCard key={gallery.id} gallery={gallery} profileId={profileId} />
              ))}
            </div>
          </section>
        )}

        {/* ── Full grid ── */}
        {items.length > 0 && (
          <section className="mb-12">
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">Full collection</h2>
            <VaultMuseumView items={items} onFilterToUniverse={() => {}} onItemClick={setSelectedItem} />
          </section>
        )}

        {/* ── Footer CTA ── */}
        <div className="mb-12 rounded-2xl bg-[color:var(--surface)] p-6 text-center ring-1 ring-[color:var(--border)]">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[color:var(--theme-gold,#C8CDD2)] mb-1">VLTD</div>
          <h3 className="font-semibold mb-1">Track your collection</h3>
          <p className="text-sm text-[color:var(--muted)] mb-4">Vault, grade, value, and share your collectibles.</p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold"
            style={{ background: "#C8CDD2", color: "#0B0B0B" }}
          >
            Start your vault →
          </Link>
        </div>

      </div>

      {selectedItem ? (
        <ProfileItemModal singleItem={selectedItem} onClose={() => setSelectedItem(null)} />
      ) : null}

      {subjectFilter ? (
        <ProfileItemModal
          listTitle={subjectFilter}
          listItems={items.filter((i) => (i.subject ?? i.category ?? i.universe) === subjectFilter)}
          onClose={() => setSubjectFilter(null)}
          onSelectItem={(item) => {
            setSubjectFilter(null);
            setSelectedItem(item);
          }}
        />
      ) : null}
    </main>
  );
}
