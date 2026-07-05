"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState, useEffect, useRef } from "react";
import WishlistCard from "@/components/WishlistCard";
import { loadWishlist, removeWishlistItem, type WishlistItem } from "@/lib/wishlistModel";
import { convertWishlistToVault } from "@/lib/wishlistToVault";
import { showToast } from "@/lib/toast";
import {
  fetchAllSources,
  groupByStoreDate,
  formatStoreDate,
  roleLabel,
  isCoverOnlyRole,
  type UpcomingIssue,
  type FederatedResult,
} from "@/lib/comicUpcoming";
import {
  loadWishlistedIds,
  loadComicWishlist,
  toggleComicWishlist,
  removeFromComicWishlist,
  type ComicWishlistItem,
} from "@/lib/comicWishlistModel";

/* ── Icons ──────────────────────────────────────────────── */

function IconHeart({ size = 24, style }: { size?: number; style?: Record<string, string | number> }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

/* ── Source styles ───────────────────────────────────────── */

const SOURCE_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  marvel:    { bg: "rgba(220,40,40,0.18)",  color: "#E05555", label: "Marvel" },
  metron:    { bg: "rgba(90,130,200,0.18)", color: "#7AABF0", label: "Metron" },
  comicvine: { bg: "rgba(80,170,100,0.18)", color: "#65C97A", label: "CV" },
};

/* ── Publisher pills ─────────────────────────────────────── */

const PUBLISHERS = [
  { label: "All", value: "" },
  { label: "Marvel", value: "Marvel" },
  { label: "DC", value: "DC Comics" },
  { label: "Dark Horse", value: "Dark Horse Comics" },
  { label: "Image", value: "Image Comics" },
  { label: "IDW", value: "IDW Publishing" },
  { label: "BOOM!", value: "BOOM! Studios" },
];

/* ── Compact issue card for wishlist search panel ───────── */

function ComicSearchCard({
  issue,
  wishlisted,
  onToggle,
}: {
  issue: UpcomingIssue;
  wishlisted: boolean;
  onToggle: (issue: UpcomingIssue) => void;
}) {
  const [imgError, setImgError] = useState(false);
  const href = issue.source === "marvel"
    ? `https://www.marvel.com/comics/issue/${issue.id}/`
    : issue.source === "comicvine"
    ? `https://comicvine.gamespot.com/issue/4000-${issue.id}/`
    : `https://metron.cloud/issue/${issue.id}/`;

  const src = issue.source ?? "metron";
  const srcStyle = SOURCE_STYLE[src] ?? SOURCE_STYLE.metron;
  const role = roleLabel(issue.creatorRole);
  const coverOnly = isCoverOnlyRole(issue.creatorRole);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(245,181,72,0.10)",
        borderRadius: "10px", overflow: "hidden",
        display: "flex", flexDirection: "column",
        textDecoration: "none", transition: "border-color 0.15s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(245,181,72,0.30)")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(245,181,72,0.10)")}
    >
      <div style={{ position: "relative", width: "100%", aspectRatio: "2/3", background: "#111", flexShrink: 0 }}>
        {issue.imageUrl && !imgError ? (
          <Image src={issue.imageUrl} alt={`${issue.series} #${issue.number}`}
            fill sizes="110px" style={{ objectFit: "cover" }} onError={() => setImgError(true)} unoptimized />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center",
            justifyContent: "center", background: "linear-gradient(145deg,#1a1a2e,#0d0d1a)" }}>
            <span style={{ fontSize: "28px", opacity: 0.3 }}>📚</span>
          </div>
        )}

        {/* Variant ribbon */}
        {issue.isVariant && (
          <div style={{
            position: "absolute", top: "4px", left: "4px",
            background: "rgba(180,100,220,0.85)", backdropFilter: "blur(4px)",
            borderRadius: "3px", padding: "1px 5px",
            fontSize: "8px", fontWeight: 700, color: "#fff", letterSpacing: "0.05em",
          }}>VARIANT</div>
        )}

        {/* Source badge */}
        <div style={{
          position: "absolute", bottom: "4px", left: "4px",
          background: srcStyle.bg, backdropFilter: "blur(4px)",
          borderRadius: "3px", padding: "1px 5px",
          fontSize: "8px", fontWeight: 700, color: srcStyle.color,
        }}>{srcStyle.label}</div>

        {/* Heart button */}
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(issue); }}
          aria-label={wishlisted ? "Remove" : "Save to wishlist"}
          style={{
            position: "absolute", top: "6px", right: "6px",
            width: "28px", height: "28px", borderRadius: "50%",
            border: wishlisted ? "1.5px solid #F5B548" : "1.5px solid rgba(255,255,255,0.25)",
            background: wishlisted ? "rgba(245,181,72,0.20)" : "rgba(0,0,0,0.55)",
            backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", transition: "all 0.15s",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
              fill={wishlisted ? "#F5B548" : "none"}
              stroke={wishlisted ? "#F5B548" : "rgba(255,255,255,0.6)"} strokeWidth="1.75" />
          </svg>
        </button>
      </div>

      <div style={{ padding: "7px 7px 9px", display: "flex", flexDirection: "column", gap: "2px", flex: 1 }}>
        <div style={{ fontSize: "11px", fontWeight: 700, color: "#F0EAD6", lineHeight: 1.3,
          overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
          {issue.series}
        </div>
        <div style={{ fontSize: "11px", color: "rgba(245,181,72,0.75)", fontWeight: 600 }}>
          #{issue.number}
        </div>
        {role && (
          <span style={{
            fontSize: "9px", fontWeight: 700, alignSelf: "flex-start",
            color: coverOnly ? "rgba(180,100,220,0.9)" : "rgba(100,200,140,0.9)",
            background: coverOnly ? "rgba(180,100,220,0.12)" : "rgba(100,200,140,0.10)",
            border: coverOnly ? "1px solid rgba(180,100,220,0.25)" : "1px solid rgba(100,200,140,0.20)",
            borderRadius: "3px", padding: "1px 4px",
          }}>{role}</span>
        )}
        {issue.storeDate && (
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", marginTop: "1px" }}>
            {formatStoreDate(issue.storeDate)}
          </div>
        )}
      </div>
    </a>
  );
}

/* ── Source summary inside panel ─────────────────────────── */

function SourceSummary({ sources }: { sources: FederatedResult["sources"] }) {
  const parts = [
    { key: "marvel",    ...SOURCE_STYLE.marvel,    count: sources.marvel.count },
    { key: "metron",    ...SOURCE_STYLE.metron,    count: sources.metron.count },
    { key: "comicvine", ...SOURCE_STYLE.comicvine, count: sources.comicvine.count },
  ].filter((s) => s.count > 0);
  if (!parts.length) return null;
  return (
    <div style={{ display: "flex", gap: "5px", flexWrap: "wrap", marginBottom: "10px", alignItems: "center" }}>
      <span style={{ fontSize: "10px", color: "rgba(240,234,214,0.35)" }}>Sources:</span>
      {parts.map((s) => (
        <span key={s.key} style={{
          fontSize: "10px", fontWeight: 700,
          background: s.bg, color: s.color, borderRadius: "5px", padding: "2px 7px",
        }}>{s.label} {s.count}</span>
      ))}
    </div>
  );
}

/* ── Comic search panel ─────────────────────────────────── */

function ComicSearchPanel({
  wishlistIds,
  onToggle,
}: {
  wishlistIds: Set<number>;
  onToggle: (issue: UpcomingIssue) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [searchMode, setSearchMode] = useState<"creator" | "series">("creator");
  const [query, setQuery] = useState("");
  const [publisher, setPublisher] = useState("");
  const [days, setDays] = useState(90);
  const [allMode, setAllMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fedResult, setFedResult] = useState<FederatedResult | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [notFound, setNotFound] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSearch(pg = 1) {
    const q = query.trim();
    if (!q && !publisher) return;
    setLoading(true);
    setNotFound(false);

    const opts = {
      days: allMode ? undefined : days,
      all: allMode || undefined,
      page: pg,
      pageSize: 24,
      publisher: publisher || undefined,
      ...(searchMode === "creator" ? { creator: q } : { series: q }),
    };

    const data = await fetchAllSources(opts);

    if (!data || data.results.length === 0) {
      setFedResult(null);
      setNotFound(true);
    } else {
      setFedResult(data);
      setCurrentPage(pg);
    }
    setLoading(false);
  }

  const groups = fedResult ? groupByStoreDate(fedResult.results) : [];
  const totalCount = fedResult?.results.length ?? 0;

  return (
    <div style={{
      border: "1px solid rgba(245,181,72,0.15)", borderRadius: "16px",
      overflow: "hidden", background: "rgba(10,10,18,0.6)", marginBottom: "24px",
    }}>
      {/* Panel toggle */}
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px", background: "transparent", border: "none", cursor: "pointer", color: "#F0EAD6",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "18px" }}>📅</span>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: "15px", fontWeight: 700 }}>Upcoming Comics</div>
            <div style={{ fontSize: "12px", color: "rgba(240,234,214,0.4)", marginTop: "1px" }}>
              Search Metron · Marvel · ComicVine — save to wishlist
            </div>
          </div>
        </div>
        <div style={{
          width: "28px", height: "28px", borderRadius: "50%",
          background: "rgba(245,181,72,0.10)", border: "1px solid rgba(245,181,72,0.20)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "13px", transition: "transform 0.2s",
          transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
        }}>▾</div>
      </button>

      {expanded && (
        <div style={{ borderTop: "1px solid rgba(245,181,72,0.10)", padding: "14px 16px 16px" }}>
          {/* Mode toggle */}
          <div style={{ display: "flex", background: "rgba(255,255,255,0.05)", borderRadius: "10px",
            padding: "3px", marginBottom: "10px", width: "fit-content" }}>
            {(["creator", "series"] as const).map((m) => (
              <button key={m} onClick={() => { setSearchMode(m); setFedResult(null); setNotFound(false); }}
                style={{
                  padding: "5px 16px", borderRadius: "8px", fontSize: "12px", fontWeight: 600,
                  border: "none", cursor: "pointer", transition: "all 0.15s",
                  background: searchMode === m ? "#F5B548" : "transparent",
                  color: searchMode === m ? "#0A0A12" : "rgba(240,234,214,0.55)",
                }}>
                {m === "creator" ? "By Artist" : "By Series"}
              </button>
            ))}
          </div>

          {/* Search bar */}
          <form onSubmit={(e) => { e.preventDefault(); handleSearch(1); }}
            style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
            <input ref={inputRef} type="text" value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchMode === "creator" ? "Artist — e.g. Peach Momoko" : "Series title"}
              style={{
                flex: 1, background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(245,181,72,0.20)", borderRadius: "10px",
                padding: "10px 13px", fontSize: "14px", color: "#F0EAD6", outline: "none",
              }} />
            <button type="submit" disabled={loading}
              style={{
                background: "#F5B548", border: "none", borderRadius: "10px",
                padding: "10px 16px", fontSize: "13px", fontWeight: 700,
                color: "#0A0A12", cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.6 : 1, whiteSpace: "nowrap",
              }}>
              {loading ? "…" : "Search"}
            </button>
          </form>

          {/* Publisher + days */}
          <div style={{ display: "flex", gap: "5px", flexWrap: "wrap", alignItems: "center", marginBottom: "14px" }}>
            {PUBLISHERS.map((p) => (
              <button key={p.value} onClick={() => setPublisher(p.value)}
                style={{
                  padding: "4px 10px", borderRadius: "100px", fontSize: "11px", fontWeight: 600,
                  border: publisher === p.value ? "1px solid #F5B548" : "1px solid rgba(255,255,255,0.12)",
                  background: publisher === p.value ? "rgba(245,181,72,0.12)" : "transparent",
                  color: publisher === p.value ? "#F5B548" : "rgba(240,234,214,0.50)",
                  cursor: "pointer", transition: "all 0.15s",
                }}>{p.label}</button>
            ))}
            <div style={{ marginLeft: "auto", display: "flex", gap: "3px" }}>
              {[30, 60, 90, 180].map((d) => (
                <button key={d} onClick={() => { setDays(d); setAllMode(false); }}
                  style={{
                    padding: "4px 8px", borderRadius: "100px", fontSize: "10px", fontWeight: 600,
                    border: !allMode && days === d ? "1px solid rgba(245,181,72,0.5)" : "1px solid rgba(255,255,255,0.08)",
                    background: !allMode && days === d ? "rgba(245,181,72,0.08)" : "transparent",
                    color: !allMode && days === d ? "rgba(245,181,72,0.8)" : "rgba(240,234,214,0.30)",
                    cursor: "pointer",
                  }}>{d}d</button>
              ))}
              <button onClick={() => setAllMode((v) => !v)}
                style={{
                  padding: "4px 8px", borderRadius: "100px", fontSize: "10px", fontWeight: 600,
                  border: allMode ? "1px solid rgba(245,181,72,0.5)" : "1px solid rgba(255,255,255,0.08)",
                  background: allMode ? "rgba(245,181,72,0.08)" : "transparent",
                  color: allMode ? "rgba(245,181,72,0.8)" : "rgba(240,234,214,0.30)",
                  cursor: "pointer",
                }}>All</button>
            </div>
          </div>

          {/* Source summary */}
          {fedResult && <SourceSummary sources={fedResult.sources} />}

          {/* Creator / count */}
          {fedResult && (
            <div style={{ fontSize: "12px", color: "rgba(245,181,72,0.7)", marginBottom: "10px" }}>
              {fedResult.resolvedCreator?.name && (
                <><strong style={{ color: "#F5B548" }}>{fedResult.resolvedCreator.name}</strong>{" · "}</>
              )}
              {totalCount} issue{totalCount !== 1 ? "s" : ""}{allMode ? " (all time)" : ` in next ${days} days`}
            </div>
          )}

          {/* Not found */}
          {notFound && !loading && (
            <div style={{ textAlign: "center", padding: "20px 16px", color: "rgba(240,234,214,0.35)" }}>
              <div style={{ fontSize: "13px", fontWeight: 600 }}>Nothing found across all sources</div>
              <div style={{ fontSize: "12px", marginTop: "4px" }}>
                {searchMode === "creator" ? 'Use the full name — e.g. "Peach Momoko"' : "Try a partial title"}
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: "8px" }}>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} style={{ aspectRatio: "2/3", borderRadius: "8px", background: "rgba(255,255,255,0.04)" }} />
              ))}
            </div>
          )}

          {/* Results */}
          {!loading && groups.map((group) => (
            <div key={group.date} style={{ marginBottom: "18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#F5B548", letterSpacing: "0.04em" }}>
                  {group.label}
                </div>
                <div style={{ flex: 1, height: "1px", background: "rgba(245,181,72,0.10)" }} />
                <div style={{ fontSize: "10px", color: "rgba(240,234,214,0.3)" }}>{group.issues.length}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: "8px" }}>
                {group.issues.map((issue) => (
                  <ComicSearchCard
                    key={`${issue.source}-${issue.id}`}
                    issue={issue}
                    wishlisted={wishlistIds.has(issue.id)}
                    onToggle={onToggle}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Saved comic card ───────────────────────────────────── */

function SavedComicCard({ item, onRemove }: { item: ComicWishlistItem; onRemove: (id: number) => void }) {
  const [imgError, setImgError] = useState(false);
  const metronUrl = `https://metron.cloud/issue/${item.metronId}/`;

  return (
    <div style={{
      background: "var(--theme-card, rgba(15,25,45,0.85))",
      border: "1px solid var(--theme-border, rgba(245,181,72,0.12))",
      borderRadius: "16px", overflow: "hidden",
      display: "flex", gap: "12px", padding: "12px", alignItems: "flex-start",
    }}>
      <a href={metronUrl} target="_blank" rel="noopener noreferrer"
        style={{ flexShrink: 0, display: "block", textDecoration: "none" }}>
        <div style={{ width: "56px", height: "84px", borderRadius: "6px", overflow: "hidden", background: "#111", position: "relative" }}>
          {item.imageUrl && !imgError ? (
            <Image src={item.imageUrl} alt={`${item.series} #${item.number}`}
              fill sizes="56px" style={{ objectFit: "cover" }} onError={() => setImgError(true)} unoptimized />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#1a1a2e" }}>
              <span style={{ fontSize: "20px", opacity: 0.4 }}>📚</span>
            </div>
          )}
        </div>
      </a>

      <div style={{ flex: 1, minWidth: 0 }}>
        <a href={metronUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--theme-text-primary, #F0EAD6)", lineHeight: 1.3 }}>
            {item.series}
          </div>
        </a>
        <div style={{ fontSize: "12px", color: "var(--theme-gold, #F5B548)", fontWeight: 600, marginTop: "2px" }}>
          #{item.number}
        </div>
        {item.publisher && (
          <div style={{ fontSize: "11px", color: "var(--theme-text-muted, #A0956B)", marginTop: "2px" }}>{item.publisher}</div>
        )}
        {item.storeDate && (
          <div style={{ fontSize: "11px", color: "rgba(240,234,214,0.35)", marginTop: "3px" }}>
            {formatStoreDate(item.storeDate, false)}
          </div>
        )}
      </div>

      <button onClick={() => onRemove(item.metronId)} aria-label="Remove"
        style={{
          flexShrink: 0, padding: "4px 8px", borderRadius: "8px",
          border: "1px solid rgba(255,255,255,0.10)", background: "transparent",
          color: "rgba(240,234,214,0.35)", fontSize: "11px", cursor: "pointer", transition: "all 0.15s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(220,60,60,0.4)"; e.currentTarget.style.color = "#E05555"; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; e.currentTarget.style.color = "rgba(240,234,214,0.35)"; }}
      >Remove</button>
    </div>
  );
}

/* ── Sort type ───────────────────────────────────────────── */

type SortMode = "newest" | "price-asc" | "price-desc" | "priority";

/* ── Main wishlist page ─────────────────────────────────── */

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistItem[]>(() => loadWishlist());
  const [sort, setSort] = useState<SortMode>("newest");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [movingId, setMovingId] = useState<string | null>(null);

  const [comicItems, setComicItems] = useState<ComicWishlistItem[]>([]);
  const [wishlistIds, setWishlistIds] = useState<Set<number>>(new Set());
  const [toggling, setToggling] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadComicWishlist().then(setComicItems).catch(() => {});
    loadWishlistedIds().then(setWishlistIds).catch(() => {});
  }, []);

  async function handleComicToggle(issue: UpcomingIssue) {
    if (toggling.has(issue.id)) return;
    const isWishlisted = wishlistIds.has(issue.id);
    setWishlistIds((prev) => { const n = new Set(prev); isWishlisted ? n.delete(issue.id) : n.add(issue.id); return n; });
    setToggling((prev) => new Set(prev).add(issue.id));

    const { ok, nowWishlisted } = await toggleComicWishlist(issue, isWishlisted);

    if (!ok) {
      setWishlistIds((prev) => { const n = new Set(prev); isWishlisted ? n.add(issue.id) : n.delete(issue.id); return n; });
    } else {
      setWishlistIds((prev) => { const n = new Set(prev); nowWishlisted ? n.add(issue.id) : n.delete(issue.id); return n; });
      loadComicWishlist().then(setComicItems).catch(() => {});
    }
    setToggling((prev) => { const n = new Set(prev); n.delete(issue.id); return n; });
  }

  async function handleComicRemove(metronId: number) {
    await removeFromComicWishlist(metronId);
    setComicItems((prev) => prev.filter((c) => c.metronId !== metronId));
    setWishlistIds((prev) => { const n = new Set(prev); n.delete(metronId); return n; });
  }

  async function handleMoveToVault(item: WishlistItem) {
    if (movingId) return;
    setMovingId(item.id);
    try {
      await convertWishlistToVault(item);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      showToast(`Moved "${item.title}" to your vault`);
    } catch {
      showToast("Couldn't move that item — try again.");
    } finally {
      setMovingId(null);
    }
  }

  function handleRemove(item: WishlistItem) {
    removeWishlistItem(item.id);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  }

  const sorted = useMemo(() => {
    let list = [...items];
    if (filterPriority !== "all") list = list.filter((i) => i.priority === filterPriority);
    if (sort === "price-asc") list.sort((a, b) => (a.targetPrice ?? Infinity) - (b.targetPrice ?? Infinity));
    else if (sort === "price-desc") list.sort((a, b) => (b.targetPrice ?? -Infinity) - (a.targetPrice ?? -Infinity));
    else if (sort === "priority") {
      const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
      list.sort((a, b) => (order[a.priority ?? ""] ?? 3) - (order[b.priority ?? ""] ?? 3));
    } else {
      list.sort((a, b) => b.createdAt - a.createdAt);
    }
    return list;
  }, [items, sort, filterPriority]);

  const hasAnything = items.length > 0 || comicItems.length > 0;

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-5">

        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-[-0.04em]"
              style={{ color: "var(--theme-text-primary, #F0EAD6)" }}>Wishlist</h1>
            <p className="mt-0.5 text-sm" style={{ color: "var(--theme-text-muted, #A0956B)" }}>
              Items you&apos;re watching or saving for later
            </p>
          </div>
          <Link href="/vault/add" className="rounded-full px-4 py-2 text-sm font-semibold transition"
            style={{
              background: "var(--theme-gold-subtle, rgba(245,181,72,0.10))",
              border: "1px solid var(--theme-gold-border, rgba(245,181,72,0.30))",
              color: "var(--theme-gold, #F5B548)",
            }}>+ Add Item</Link>
        </div>

        {/* Comic search panel */}
        <ComicSearchPanel wishlistIds={wishlistIds} onToggle={handleComicToggle} />

        {/* Saved comics */}
        {comicItems.length > 0 && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <h2 className="text-base font-bold" style={{ color: "var(--theme-text-primary, #F0EAD6)" }}>Saved Comics</h2>
              <span style={{
                fontSize: "11px", fontWeight: 700, color: "#F5B548",
                background: "rgba(245,181,72,0.10)", border: "1px solid rgba(245,181,72,0.20)",
                borderRadius: "100px", padding: "2px 8px",
              }}>{comicItems.length}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {comicItems.map((item) => (
                <SavedComicCard key={item.id} item={item} onRemove={handleComicRemove} />
              ))}
            </div>
          </div>
        )}

        {/* General wishlist */}
        {items.length > 0 && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h2 className="text-base font-bold" style={{ color: "var(--theme-text-primary, #F0EAD6)" }}>Saved Items</h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <select value={sort} onChange={(e) => setSort(e.target.value as SortMode)}
                className="h-9 rounded-xl bg-[color:var(--pill)] px-3 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
                style={{ color: "var(--fg)" }}>
                <option value="newest">Newest First</option>
                <option value="priority">Priority</option>
                <option value="price-asc">Target Price Up</option>
                <option value="price-desc">Target Price Down</option>
              </select>
              <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}
                className="h-9 rounded-xl bg-[color:var(--pill)] px-3 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
                style={{ color: "var(--fg)" }}>
                <option value="all">All Priorities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <span className="self-center text-xs" style={{ color: "var(--muted)" }}>
                {sorted.length} item{sorted.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {sorted.map((item) => (
                <WishlistCard key={item.id} item={item} onMoveToVault={handleMoveToVault} onRemove={handleRemove} />
              ))}
            </div>
          </>
        )}

        {/* Empty state */}
        {!hasAnything && (
          <div className="rounded-[24px] border p-8 text-center"
            style={{ background: "var(--theme-card, rgba(15,25,45,0.85))", borderColor: "var(--theme-border, rgba(245,181,72,0.12))" }}>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ background: "var(--theme-gold-subtle, rgba(245,181,72,0.10))", border: "1px solid var(--theme-gold-border, rgba(245,181,72,0.25))" }}>
              <IconHeart size={24} style={{ color: "var(--theme-gold, #F5B548)" }} />
            </div>
            <h2 className="text-xl font-bold" style={{ color: "var(--theme-text-primary, #F0EAD6)" }}>
              Your wishlist is empty
            </h2>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed" style={{ color: "var(--theme-text-muted, #A0956B)" }}>
              Search upcoming comics above, or add items manually.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Link href="/vault/add" className="rounded-full px-5 py-2 text-sm font-semibold transition"
                style={{ background: "linear-gradient(135deg,#8B6914 0%,#C8941F 25%,#F5B548 50%,#FFE08A 70%,#C8941F 100%)", color: "#0B0B0B" }}>
                Browse &amp; Add Items
              </Link>
              <Link href="/vault" className="rounded-full border px-5 py-2 text-sm font-semibold transition"
                style={{ borderColor: "var(--theme-gold-border, rgba(245,181,72,0.30))", color: "var(--theme-gold, #F5B548)" }}>
                Go to Vault
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
