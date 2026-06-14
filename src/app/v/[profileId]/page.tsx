"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";

import VaultMuseumView from "@/components/VaultMuseumView";
import {
  fetchPublicProfile,
  fetchPublicVaultItems,
  type PublicProfile,
} from "@/lib/publicProfile";
import { getPrimaryImageUrl, type VaultItem } from "@/lib/vaultModel";

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
const UNIVERSE_EMOJI: Record<string, string> = {
  TCG: "🃏", Sports: "⚾", Vinyl: "💿", Comics: "📚", Art: "🎨",
  Toys: "🧸", Books: "📖", Coins: "🪙", Stamps: "📮", Film: "🎬",
  Games: "🎮", Fashion: "👟", Watches: "⌚", Jewelry: "💎",
};
function UniverseChip({ universe, count }: { universe: string; count: number }) {
  const emoji = UNIVERSE_EMOJI[universe] ?? "📦";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--pill)] px-3 py-1.5 text-xs font-semibold ring-1 ring-[color:var(--border)]">
      <span>{emoji}</span>
      <span>{universe}</span>
      <span className="opacity-50">·</span>
      <span className="opacity-70">{count}</span>
    </span>
  );
}

// ─── Featured item card ────────────────────────────────────────────────────────
function FeaturedCard({ item }: { item: VaultItem }) {
  const imageUrl = getPrimaryImageUrl(item);
  return (
    <div className="relative overflow-hidden rounded-2xl bg-[color:var(--surface)] ring-1 ring-[color:var(--border)]">
      <div className="aspect-[3/4] w-full overflow-hidden bg-[color:var(--pill)]">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={item.title ?? ""}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl opacity-20">🖼</div>
        )}
      </div>
      <div className="p-3">
        <div className="truncate text-sm font-semibold">{item.title ?? "Untitled"}</div>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[color:var(--muted)]">
          <span>{item.universe ?? item.category ?? ""}</span>
          {item.grade && (
            <>
              <span>·</span>
              <span className="font-semibold text-[color:var(--theme-gold,#F5B548)]">
                Grade {item.grade}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [nextProfile, nextItems] = await Promise.all([
          fetchPublicProfile(profileId),
          fetchPublicVaultItems(profileId),
        ]);
        if (!active) return;
        setProfile(nextProfile);
        setItems(nextItems);
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
      <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-sm text-[color:var(--muted)]">Loading vault…</div>
        </div>
      </main>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">
        <div className="mx-auto max-w-lg px-4 py-20 text-center">
          <div className="text-4xl mb-4">🔒</div>
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
    <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">

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
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[color:var(--pill)] px-3 text-xs font-semibold ring-1 ring-[color:var(--border)]"
            >
              {copied ? "✓ Copied" : "Share"}
            </button>
            <Link
              href="/"
              className="inline-flex h-8 items-center rounded-full bg-[color:var(--pill)] px-3 text-[11px] font-bold tracking-[0.16em] text-[color:var(--theme-gold,#F5B548)] ring-1 ring-[color:var(--border)]"
            >
              VLTD
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4">

        {/* ── Hero ── */}
        <div className="py-8 flex flex-col items-center text-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-[color:var(--pill)] text-5xl ring-2 ring-[color:var(--border)] shadow-lg">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              avatarEmoji
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{displayName}</h1>
            {bio && <p className="mt-2 max-w-md text-sm leading-relaxed text-[color:var(--muted)]">{bio}</p>}
          </div>

          {/* Stats bar */}
          {items.length > 0 && (
            <div className="flex flex-wrap justify-center divide-x divide-[color:var(--border)] rounded-2xl bg-[color:var(--surface)] ring-1 ring-[color:var(--border)] overflow-hidden">
              <Stat value={items.length} label={items.length === 1 ? "Item" : "Items"} />
              {universes.length > 0 && <Stat value={universes.length} label={universes.length === 1 ? "Universe" : "Universes"} />}
              {gradedCount > 0 && <Stat value={gradedCount} label="Graded" />}
              {topGrade !== null && <Stat value={topGrade} label="Top Grade" />}
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
            <div className="text-4xl mb-3">📦</div>
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
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">Featured</h2>
              <span className="text-[10px] text-[color:var(--muted2)]">{plural(items.length, "public item")}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {featuredItems.map((item) => (
                <FeaturedCard key={item.id} item={item} />
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
                <Link
                  key={subject}
                  href={`/registry/${encodeURIComponent(subject)}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--surface)] px-4 py-2 text-sm font-medium ring-1 ring-[color:var(--border)] hover:ring-[color:var(--border-strong)]"
                >
                  {subject}
                  <span className="rounded-full bg-[color:var(--pill)] px-1.5 py-0.5 text-[10px] font-semibold">{count}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Full grid ── */}
        {items.length > 0 && (
          <section className="mb-12">
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">Full collection</h2>
            <VaultMuseumView items={items} onFilterToUniverse={() => {}} />
          </section>
        )}

        {/* ── Footer CTA ── */}
        <div className="mb-12 rounded-2xl bg-[color:var(--surface)] p-6 text-center ring-1 ring-[color:var(--border)]">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[color:var(--theme-gold,#F5B548)] mb-1">VLTD</div>
          <h3 className="font-semibold mb-1">Track your collection</h3>
          <p className="text-sm text-[color:var(--muted)] mb-4">Vault, grade, value, and share your collectibles.</p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-full bg-[color:var(--theme-gold,#F5B548)] px-5 py-2 text-sm font-bold text-black"
          >
            Start your vault →
          </Link>
        </div>

      </div>
    </main>
  );
}
