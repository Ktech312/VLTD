"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";

import VaultMuseumView from "@/components/VaultMuseumView";
import {
  fetchPublicProfile,
  fetchPublicVaultItems,
  type PublicProfile,
  type SocialLinks,
} from "@/lib/publicProfile";
import { getPrimaryImageUrl, type VaultItem } from "@/lib/vaultModel";

// ── Social link definitions ──────────────────────────────────────
const SOCIAL_DEFS = [
  { key: "instagram" as const,  label: "Instagram",   icon: "📸", prefix: "https://instagram.com/" },
  { key: "twitter" as const,    label: "X / Twitter", icon: "𝕏",  prefix: "https://x.com/" },
  { key: "tiktok" as const,     label: "TikTok",      icon: "🎵", prefix: "https://tiktok.com/@" },
  { key: "youtube" as const,    label: "YouTube",     icon: "▶️", prefix: "https://youtube.com/@" },
  { key: "facebook" as const,   label: "Facebook",    icon: "👥", prefix: "https://facebook.com/" },
  { key: "whatnot" as const,    label: "Whatnot",     icon: "🔨", prefix: "https://whatnot.com/user/" },
  { key: "ebay" as const,       label: "eBay",        icon: "🛒", prefix: "https://ebay.com/usr/" },
  { key: "website" as const,    label: "Website",     icon: "🌐", prefix: "" },
  { key: "linktree" as const,   label: "Linktree",    icon: "🌿", prefix: "https://linktr.ee/" },
];

// ── helpers ──────────────────────────────────────────────────────
function plural(n: number, word: string) { return `${n} ${word}${n === 1 ? "" : "s"}`; }
function copyToClipboard(text: string) { void navigator.clipboard.writeText(text); }

function getTopSubjects(items: VaultItem[], limit = 5) {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const s = item.subject ?? item.category ?? item.universe;
    if (s) counts[s] = (counts[s] ?? 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([subject, count]) => ({ subject, count }));
}

function getGradedCount(items: VaultItem[]) { return items.filter((i) => i.grade).length; }
function getTopGrade(items: VaultItem[]) {
  const numeric = items.filter((i) => i.grade).map((i) => parseFloat(i.grade ?? "0")).filter((n) => !isNaN(n));
  return numeric.length ? Math.max(...numeric) : null;
}

// ── Sub-components ───────────────────────────────────────────────
function StatChip({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-4 py-2">
      <span className="text-lg font-black tabular-nums" style={{ color: "#F5B548" }}>{value}</span>
      <span className="text-[9px] uppercase tracking-[0.18em] text-[#A0956B]">{label}</span>
    </div>
  );
}

function SocialChips({ links }: { links: SocialLinks }) {
  const active = SOCIAL_DEFS.filter((d) => links[d.key]);
  if (!active.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {active.map((def) => {
        const val = links[def.key]!;
        const url = def.key === "website" ? val : def.prefix + val.replace(/^@/, "");
        return (
          <a key={def.key} href={url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition hover:brightness-125"
            style={{ borderColor: "rgba(245,181,72,0.22)", background: "rgba(245,181,72,0.06)", color: "#C8BFA8" }}>
            <span>{def.icon}</span>
            <span>{def.label}</span>
          </a>
        );
      })}
    </div>
  );
}

function FeaturedCard({ item }: { item: VaultItem }) {
  const imageUrl = getPrimaryImageUrl(item);
  return (
    <div className="overflow-hidden rounded-2xl border" style={{ background: "rgba(10,18,35,0.9)", borderColor: "rgba(245,181,72,0.12)" }}>
      <div className="aspect-[3/4] w-full overflow-hidden" style={{ background: "rgba(15,25,45,0.85)" }}>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={item.title ?? ""} className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full items-center justify-center text-3xl opacity-20">🖼</div>
        )}
      </div>
      <div className="p-3">
        <div className="truncate text-xs font-semibold text-text-primary">{item.title ?? "Untitled"}</div>
        <div className="mt-0.5 text-[10px] text-[#A0956B]">
          {item.universe ?? item.category ?? ""}
          {item.grade && <span className="ml-2 font-semibold" style={{ color: "#F5B548" }}>Grade {item.grade}</span>}
        </div>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────
export default function PublicVaultPage({ params }: { params: Promise<{ profileId: string }> }) {
  const { profileId } = use(params);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true); setError("");
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
      } finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [profileId]);

  const displayName = profile?.displayName ?? "Collector";
  const avatarEmoji = profile?.avatarEmoji ?? "🗝️";
  const bio = profile?.bio ?? "";
  const socialLinks = profile?.socialLinks ?? {};

  const topSubjects = useMemo(() => getTopSubjects(items), [items]);
  const gradedCount = useMemo(() => getGradedCount(items), [items]);
  const topGrade = useMemo(() => getTopGrade(items), [items]);

  const featuredItems = useMemo(() =>
    [...items].sort((a, b) => {
      const ag = a.grade ? 1 : 0; const bg = b.grade ? 1 : 0;
      if (bg !== ag) return bg - ag;
      return Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0);
    }).slice(0, 4),
  [items]);

  function handleCopyLink() {
    copyToClipboard(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return (
    <main className="min-h-screen" style={{ background: "var(--bg, #090E1A)" }}>
      <div className="flex min-h-screen items-center justify-center text-sm text-[#A0956B]">Loading vault…</div>
    </main>
  );

  if (error) return (
    <main className="min-h-screen" style={{ background: "var(--bg, #090E1A)" }}>
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <div className="text-4xl mb-4">🔒</div>
        <h1 className="text-xl font-semibold mb-2 text-white">Vault not found</h1>
        <p className="text-sm text-[#A0956B] mb-6">{error}</p>
        <Link href="/" className="rounded-full px-5 py-2 text-sm font-semibold" style={{ background: "rgba(245,181,72,0.10)", border: "1px solid rgba(245,181,72,0.25)", color: "#F5B548" }}>Back to VLTD</Link>
      </div>
    </main>
  );

  return (
    <main className="min-h-screen text-[color:var(--fg,#EDEBE3)]" style={{ background: "var(--bg, #090E1A)" }}>

      {/* ── Top nav ── */}
      <header className="sticky top-0 z-30 border-b backdrop-blur px-4 py-3" style={{ background: "rgba(9,14,26,0.92)", borderColor: "rgba(245,181,72,0.10)" }}>
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border text-lg shrink-0" style={{ background: "rgba(245,181,72,0.06)", borderColor: "rgba(245,181,72,0.22)" }}>
            {avatarEmoji}
          </div>
          <span className="font-semibold text-sm truncate">{displayName}&apos;s Vault</span>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={handleCopyLink} className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold border" style={{ background: "rgba(245,181,72,0.06)", borderColor: "rgba(245,181,72,0.18)", color: "#A0956B" }}>
              {copied ? "✓ Copied" : "Share"}
            </button>
            <Link href="/" className="inline-flex h-8 items-center rounded-full px-3 text-[11px] font-bold tracking-[0.16em]" style={{ background: "rgba(245,181,72,0.08)", borderColor: "rgba(245,181,72,0.22)", border: "1px solid rgba(245,181,72,0.22)", color: "#F5B548" }}>VLTD</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 pb-16">

        {/* ── Profile Hero ── */}
        <div className="py-8">
          <div className="rounded-[24px] border p-5 sm:p-6" style={{ background: "rgba(15,25,45,0.85)", borderColor: "rgba(245,181,72,0.16)" }}>
            <div className="flex flex-col sm:flex-row items-start gap-5">
              {/* Avatar */}
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border text-3xl" style={{ background: "rgba(245,181,72,0.06)", borderColor: "rgba(245,181,72,0.28)" }}>
                {avatarEmoji}
              </div>

              {/* Name + bio */}
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-black tracking-[-0.03em] text-white">{displayName}</h1>
                {bio && <p className="mt-2 text-sm leading-relaxed text-[#C8BFA8] max-w-lg">{bio}</p>}

                {/* Social links */}
                {Object.values(socialLinks).some(Boolean) && (
                  <div className="mt-3">
                    <SocialChips links={socialLinks} />
                  </div>
                )}
              </div>
            </div>

            {/* Stats */}
            {items.length > 0 && (
              <div className="mt-5 flex flex-wrap divide-x rounded-xl overflow-hidden border" style={{ borderColor: "rgba(245,181,72,0.12)", background: "rgba(10,18,35,0.6)" }}>
                <StatChip value={items.length} label={items.length === 1 ? "Item" : "Items"} />
                {gradedCount > 0 && <StatChip value={gradedCount} label="Graded" />}
                {topGrade !== null && <StatChip value={topGrade} label="Top Grade" />}
                {topSubjects.length > 0 && <StatChip value={topSubjects.length} label="Subjects" />}
              </div>
            )}
          </div>
        </div>

        {/* ── Empty state ── */}
        {items.length === 0 && (
          <div className="rounded-2xl border p-10 text-center mb-10" style={{ background: "rgba(15,25,45,0.85)", borderColor: "rgba(245,181,72,0.12)" }}>
            <div className="text-4xl mb-3">📦</div>
            <h2 className="text-lg font-semibold mb-1 text-white">Nothing public yet</h2>
            <p className="text-sm text-[#A0956B] mb-5">{displayName} hasn&apos;t made any items public.</p>
            <Link href="/" className="rounded-full px-5 py-2 text-sm font-semibold" style={{ background: "rgba(245,181,72,0.10)", border: "1px solid rgba(245,181,72,0.25)", color: "#F5B548" }}>Explore VLTD</Link>
          </div>
        )}

        {/* ── Featured items ── */}
        {featuredItems.length > 0 && (
          <section className="mb-8">
            <div className="mb-3 flex items-baseline gap-2">
              <h2 className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#A0956B]">Featured</h2>
              <span className="text-[10px] text-[#635F59]">{plural(items.length, "public item")}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {featuredItems.map((item) => <FeaturedCard key={item.id} item={item} />)}
            </div>
          </section>
        )}

        {/* ── Top subjects ── */}
        {topSubjects.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#A0956B]">Collects most</h2>
            <div className="flex flex-wrap gap-2">
              {topSubjects.map(({ subject, count }) => (
                <Link key={subject} href={`/registry/${encodeURIComponent(subject)}`}
                  className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium border transition hover:brightness-110"
                  style={{ background: "rgba(15,25,45,0.85)", borderColor: "rgba(245,181,72,0.14)", color: "#C8BFA8" }}>
                  {subject}
                  <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: "rgba(245,181,72,0.10)", color: "#A0956B" }}>{count}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Full grid ── */}
        {items.length > 0 && (
          <section className="mb-12">
            <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#A0956B]">Full collection</h2>
            <VaultMuseumView items={items} onFilterToUniverse={() => {}} />
          </section>
        )}

        {/* ── Footer CTA ── */}
        <div className="rounded-2xl border p-6 text-center" style={{ background: "rgba(15,25,45,0.85)", borderColor: "rgba(245,181,72,0.12)" }}>
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] mb-1" style={{ color: "#F5B548" }}>VLTD</div>
          <h3 className="font-semibold mb-1 text-white">Track your collection</h3>
          <p className="text-sm text-[#A0956B] mb-4">Vault, grade, value, and share your collectibles.</p>
          <Link href="/signup" className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold text-black" style={{ background: "#F5B548" }}>
            Start your vault →
          </Link>
        </div>

      </div>
    </main>
  );
}
