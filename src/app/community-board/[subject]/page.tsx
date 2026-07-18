"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { fetchSubjectLeaderboard, type LeaderboardEntry } from "@/lib/registryModel";
import { Glyph } from "@/components/ui/Glyph";

function fmt(n: number) {
  if (n === 0) return "--";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return (
    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
      style={{ background: "linear-gradient(135deg,#f5b548,#e09020)", color: "#000" }}>1</div>
  );
  if (rank === 2) return (
    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
      style={{ background: "linear-gradient(135deg,#c0c8d8,#8090a8)", color: "#000" }}>2</div>
  );
  if (rank === 3) return (
    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
      style={{ background: "linear-gradient(135deg,#d4884a,#a06030)", color: "#fff" }}>3</div>
  );
  return (
    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ring-1 ring-[color:var(--border)]"
      style={{ background: "var(--pill)", color: "var(--muted)" }}>{rank}</div>
  );
}

function CollectorCard({ entry }: { entry: LeaderboardEntry }) {
  const [copied, setCopied] = useState(false);

  function handleShare() {
    const url = `${window.location.origin}/community-board/${encodeURIComponent(entry.profileId)}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div
      className="rounded-2xl p-5 ring-1 ring-[color:var(--border)]"
      style={{
        background: "var(--surface)",
        boxShadow: entry.rank <= 3 ? "0 0 0 1px var(--theme-gold)" : undefined,
      }}
    >
      <div className="flex items-start gap-4">
        <RankBadge rank={entry.rank} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xl">{entry.avatarEmoji}</span>
            <Link
              href={`/v/${entry.profileId}`}
              className="text-base font-bold hover:underline truncate"
              style={{ color: "var(--fg)" }}
            >
              {entry.displayName}
            </Link>
          </div>
          {entry.bio && (
            <p className="mt-1 text-xs line-clamp-2" style={{ color: "var(--muted)" }}>{entry.bio}</p>
          )}
          <div className="mt-2 flex gap-4 text-[11px]" style={{ color: "var(--muted)" }}>
            <span><strong style={{ color: "var(--fg)" }}>{entry.itemCount}</strong> items</span>
            {entry.totalValue > 0 && (
              <span><strong style={{ color: "var(--fg)" }}>{fmt(entry.totalValue)}</strong> est. value</span>
            )}
          </div>
        </div>
        <button
          onClick={handleShare}
          className="shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold ring-1 ring-[color:var(--border)] transition hover:brightness-110"
          style={{ background: "var(--pill)", color: "var(--muted)" }}
        >
          {copied ? "Copied!" : "Share"}
        </button>
      </div>

      {/* Sample item thumbnails */}
      {entry.sampleItems.length > 0 && (
        <div className="mt-4 flex gap-2 overflow-hidden">
          {entry.sampleItems.map((item) => (
            <div
              key={item.id}
              className="w-14 h-14 rounded-xl shrink-0 overflow-hidden ring-1 ring-[color:var(--border)]"
              style={{ background: "var(--pill)" }}
              title={item.title}
            >
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-lg opacity-20">◈</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SubjectCommunityBoardPage({ params }: { params: Promise<{ subject: string }> }) {
  const { subject } = use(params);
  const decoded = decodeURIComponent(subject);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchSubjectLeaderboard(decoded).then((data) => { setEntries(data); setLoading(false); });
  }, [decoded]);

  function handleSharePage() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const totalItems = entries.reduce((s, e) => s + e.itemCount, 0);
  const totalCollectors = entries.length;

  return (
    <div className="" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <div className="border-b border-[color:var(--border)]" style={{ background: "var(--surface)" }}>
        <div className="mx-auto max-w-2xl px-4 py-6">
          <div className="flex items-center gap-3 text-sm" style={{ color: "var(--muted)" }}>
            <Link href="/discover">Discover</Link>
            <span>/</span>
            <Link href="/community-board">Community Board</Link>
            <span>/</span>
            <span style={{ color: "var(--fg)" }}>{decoded}</span>
          </div>
          <div className="mt-3 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: "var(--fg)" }}>{decoded}</h1>
              <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                {loading ? "Loading..." : `${totalCollectors} collector${totalCollectors !== 1 ? "s" : ""} · ${totalItems} items`}
              </p>
            </div>
            <button
              onClick={handleSharePage}
              className="shrink-0 rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-[color:var(--border)] transition hover:brightness-110"
              style={{ background: "var(--pill)", color: "var(--muted)" }}
            >
              {copied ? "Copied!" : "Share Leaderboard"}
            </button>
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-4">
        {loading ? (
          <div className="text-center py-16 text-sm" style={{ color: "var(--muted)" }}>Loading leaderboard...</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16">
            <div className="mb-3 flex justify-center opacity-30"><Glyph name="trophy" size={40} style={{ color: "var(--theme-gold)" }} /></div>
            <div className="text-sm" style={{ color: "var(--muted)" }}>No public collectors found for this subject yet.</div>
            <Link href="/community-board" className="mt-4 inline-block text-sm underline" style={{ color: "var(--theme-gold)" }}>
              Browse all subjects
            </Link>
          </div>
        ) : (
          entries.map((entry) => <CollectorCard key={entry.profileId} entry={entry} />)
        )}
      </div>
    </div>
  );
}
