"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import {
  fetchUpcomingComics,
  groupByStoreDate,
  type UpcomingComicsResult,
  type UpcomingIssue,
} from "@/lib/comicUpcoming";
import {
  loadWishlistedIds,
  toggleComicWishlist,
} from "@/lib/comicWishlistModel";

/* ── Publisher quick-filter pills ─────────────────────────── */

const PUBLISHERS = [
  { label: "All",        value: "" },
  { label: "Marvel",     value: "Marvel" },
  { label: "DC",         value: "DC Comics" },
  { label: "Dark Horse", value: "Dark Horse Comics" },
  { label: "Image",      value: "Image Comics" },
  { label: "IDW",        value: "IDW Publishing" },
  { label: "BOOM!",      value: "BOOM! Studios" },
];

/* ── Issue card ──────────────────────────────────────────── */

function IssueCard({
  issue,
  wishlisted,
  onToggle,
}: {
  issue: UpcomingIssue;
  wishlisted: boolean;
  onToggle: (issue: UpcomingIssue) => void;
}) {
  const [imgError, setImgError] = useState(false);
  const metronUrl = `https://metron.cloud/issue/${issue.id}/`;

  return (
    <a
      href={metronUrl}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(245,181,72,0.10)",
        borderRadius: "12px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        textDecoration: "none",
        cursor: "pointer",
        transition: "border-color 0.15s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(245,181,72,0.30)")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(245,181,72,0.10)")}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "2/3",
          background: "#111",
          flexShrink: 0,
        }}
      >
        {issue.imageUrl && !imgError ? (
          <Image
            src={issue.imageUrl}
            alt={`${issue.series} #${issue.number}`}
            fill
            sizes="(max-width: 640px) 45vw, 180px"
            style={{ objectFit: "cover" }}
            onError={() => setImgError(true)}
            unoptimized
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(145deg, #1a1a2e 0%, #0d0d1a 100%)",
            }}
          >
            <span style={{ fontSize: "36px", opacity: 0.3 }}>&#128218;</span>
          </div>
        )}

        {/* Heart / wishlist toggle */}
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(issue); }}
          aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
          style={{
            position: "absolute",
            top: "8px",
            right: "8px",
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            border: wishlisted
              ? "1.5px solid #F5B548"
              : "1.5px solid rgba(255,255,255,0.25)",
            background: wishlisted
              ? "rgba(245,181,72,0.20)"
              : "rgba(0,0,0,0.55)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "all 0.15s",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
              fill={wishlisted ? "#F5B548" : "none"}
              stroke={wishlisted ? "#F5B548" : "rgba(255,255,255,0.6)"}
              strokeWidth="1.75"
            />
          </svg>
        </button>
      </div>

      <div style={{ padding: "10px 10px 12px", display: "flex", flexDirection: "column", gap: "4px", flex: 1 }}>
        <div
          style={{
            fontSize: "13px",
            fontWeight: 700,
            color: "#F0EAD6",
            lineHeight: 1.3,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {issue.series}
        </div>
        <div style={{ fontSize: "12px", color: "rgba(245,181,72,0.75)", fontWeight: 600 }}>
          #{issue.number}
        </div>
        <div
          style={{
            fontSize: "11px",
            color: "rgba(255,255,255,0.35)",
            marginTop: "2px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {issue.publisher}
        </div>
      </div>
    </a>
  );
}

/* ── Main page ───────────────────────────────────────────── */

export default function UpcomingPage() {
  const [mode, setMode]           = useState<"creator" | "series">("creator");
  const [query, setQuery]         = useState("");
  const [publisher, setPublisher] = useState("");
  const [days, setDays]           = useState(90);
  const [allMode, setAllMode]     = useState(false);
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState<UpcomingComicsResult | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [wishlistIds, setWishlistIds] = useState<Set<number>>(new Set());
  const [toggling, setToggling]   = useState<Set<number>>(new Set());
  const [notFound, setNotFound]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load persisted wishlist on mount
  useEffect(() => {
    loadWishlistedIds().then(setWishlistIds).catch(() => {});
  }, []);

  async function handleSearch(pg = 1) {
    const q = query.trim();
    if (!q && !publisher) return;
    setLoading(true);
    setNotFound(false);

    const opts = {
      days: allMode ? undefined : days,
      all: allMode || undefined,
      page: pg,
      pageSize: 25,
      publisher: publisher || undefined,
      ...(mode === "creator" ? { creator: q } : { series: q }),
    };

    const data = await fetchUpcomingComics(opts);

    if (!data || data.count === 0) {
      setResult(null);
      setNotFound(true);
    } else {
      setResult(data);
      setCurrentPage(pg);
    }
    setLoading(false);
  }

  async function handleToggle(issue: UpcomingIssue) {
    if (toggling.has(issue.id)) return;

    const isWishlisted = wishlistIds.has(issue.id);

    // Optimistic update
    setWishlistIds((prev) => {
      const next = new Set(prev);
      if (isWishlisted) next.delete(issue.id);
      else next.add(issue.id);
      return next;
    });
    setToggling((prev) => new Set(prev).add(issue.id));

    const { ok, nowWishlisted } = await toggleComicWishlist(issue, isWishlisted);

    // Reconcile if server disagreed
    if (!ok) {
      setWishlistIds((prev) => {
        const next = new Set(prev);
        if (isWishlisted) next.add(issue.id);
        else next.delete(issue.id);
        return next;
      });
    } else {
      setWishlistIds((prev) => {
        const next = new Set(prev);
        if (nowWishlisted) next.add(issue.id);
        else next.delete(issue.id);
        return next;
      });
    }

    setToggling((prev) => {
      const next = new Set(prev);
      next.delete(issue.id);
      return next;
    });
  }

  const groups = result ? groupByStoreDate(result.results) : [];

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#0A0A12",
        color: "#F0EAD6",
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 90px)",
      }}
    >
      {/* Header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          background: "rgba(10,10,18,0.95)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(245,181,72,0.08)",
          padding: "16px 16px 12px",
        }}
      >
        <div style={{ maxWidth: "680px", margin: "0 auto" }}>

          {/* Title */}
          <div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginBottom: "14px" }}>
            <span style={{ fontSize: "22px", fontWeight: 900, letterSpacing: "-0.02em" }}>
              Upcoming Comics
            </span>
            {wishlistIds.size > 0 && (
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#F5B548",
                  background: "rgba(245,181,72,0.12)",
                  border: "1px solid rgba(245,181,72,0.25)",
                  borderRadius: "100px",
                  padding: "2px 9px",
                }}
              >
                {wishlistIds.size} saved
              </span>
            )}
          </div>

          {/* Mode toggle */}
          <div
            style={{
              display: "flex",
              background: "rgba(255,255,255,0.05)",
              borderRadius: "10px",
              padding: "3px",
              marginBottom: "10px",
              width: "fit-content",
            }}
          >
            {(["creator", "series"] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setResult(null); setNotFound(false); }}
                style={{
                  padding: "6px 18px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  background: mode === m ? "#F5B548" : "transparent",
                  color: mode === m ? "#0A0A12" : "rgba(240,234,214,0.55)",
                }}
              >
                {m === "creator" ? "By Artist" : "By Series"}
              </button>
            ))}
          </div>

          {/* Search bar */}
          <form
            onSubmit={(e) => { e.preventDefault(); handleSearch(1); }}
            style={{ display: "flex", gap: "8px", marginBottom: "10px" }}
          >
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                mode === "creator"
                  ? "Artist name — e.g. Peach Momoko"
                  : "Series title — e.g. Demon Days"
              }
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(245,181,72,0.20)",
                borderRadius: "10px",
                padding: "11px 14px",
                fontSize: "15px",
                color: "#F0EAD6",
                outline: "none",
              }}
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                background: "#F5B548",
                border: "none",
                borderRadius: "10px",
                padding: "11px 18px",
                fontSize: "14px",
                fontWeight: 700,
                color: "#0A0A12",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.6 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {loading ? "..." : "Search"}
            </button>
          </form>

          {/* Publisher pills + days selector */}
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
            {PUBLISHERS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPublisher(p.value)}
                style={{
                  padding: "5px 12px",
                  borderRadius: "100px",
                  fontSize: "12px",
                  fontWeight: 600,
                  border: publisher === p.value
                    ? "1px solid #F5B548"
                    : "1px solid rgba(255,255,255,0.12)",
                  background: publisher === p.value
                    ? "rgba(245,181,72,0.12)"
                    : "transparent",
                  color: publisher === p.value ? "#F5B548" : "rgba(240,234,214,0.55)",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {p.label}
              </button>
            ))}

            <div style={{ marginLeft: "auto", display: "flex", gap: "4px" }}>
              {[30, 60, 90, 180].map((d) => (
                <button
                  key={d}
                  onClick={() => { setDays(d); setAllMode(false); }}
                  style={{
                    padding: "5px 10px",
                    borderRadius: "100px",
                    fontSize: "11px",
                    fontWeight: 600,
                    border: !allMode && days === d
                      ? "1px solid rgba(245,181,72,0.5)"
                      : "1px solid rgba(255,255,255,0.08)",
                    background: !allMode && days === d ? "rgba(245,181,72,0.08)" : "transparent",
                    color: !allMode && days === d ? "rgba(245,181,72,0.8)" : "rgba(240,234,214,0.35)",
                    cursor: "pointer",
                  }}
                >
                  {d}d
                </button>
              ))}
              <button
                onClick={() => setAllMode((prev) => !prev)}
                style={{
                  padding: "5px 10px",
                  borderRadius: "100px",
                  fontSize: "11px",
                  fontWeight: 600,
                  border: allMode
                    ? "1px solid rgba(245,181,72,0.5)"
                    : "1px solid rgba(255,255,255,0.08)",
                  background: allMode ? "rgba(245,181,72,0.08)" : "transparent",
                  color: allMode ? "rgba(245,181,72,0.8)" : "rgba(240,234,214,0.35)",
                  cursor: "pointer",
                }}
              >
                All
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: "680px", margin: "0 auto", padding: "16px" }}>

        {/* Resolved creator banner */}
        {result?.resolvedCreator?.name && (
          <div
            style={{
              background: "rgba(245,181,72,0.08)",
              border: "1px solid rgba(245,181,72,0.18)",
              borderRadius: "10px",
              padding: "10px 14px",
              marginBottom: "16px",
              fontSize: "13px",
              color: "rgba(245,181,72,0.85)",
            }}
          >
            Showing work by{" "}
            <strong style={{ color: "#F5B548" }}>{result.resolvedCreator.name}</strong>
            {" "}&middot; {result.count} issue{result.count !== 1 ? "s" : ""}{allMode ? " (all time)" : ` in next ${days} days`}
          </div>
        )}

        {/* Series count */}
        {result && !result.resolvedCreator && (
          <div style={{ fontSize: "13px", color: "rgba(240,234,214,0.4)", marginBottom: "14px" }}>
            {result.count} issue{result.count !== 1 ? "s" : ""}
            {publisher ? ` · ${publisher}` : ""}{allMode ? " (all time)" : ` in next ${days} days`}
          </div>
        )}

        {/* Not found */}
        {notFound && !loading && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "rgba(240,234,214,0.35)" }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>&#128269;</div>
            <div style={{ fontSize: "16px", fontWeight: 600, marginBottom: "6px" }}>Nothing found</div>
            <div style={{ fontSize: "13px" }}>
              {mode === "creator"
                ? 'Try the full name — e.g. "Peach Momoko" not just "Momoko"'
                : "Try a partial title or check the publisher filter"}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!result && !notFound && !loading && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "rgba(240,234,214,0.30)" }}>
            <div style={{ fontSize: "48px", marginBottom: "14px" }}>&#128197;</div>
            <div style={{ fontSize: "16px", fontWeight: 600, marginBottom: "6px", color: "rgba(240,234,214,0.5)" }}>
              Find what&apos;s dropping soon
            </div>
            <div style={{ fontSize: "13px", lineHeight: 1.6 }}>
              Search by artist (e.g. Peach Momoko) or series title.<br />
              Results pull from <span style={{ color: "rgba(245,181,72,0.6)" }}>Metron</span> and are saved to your account.
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {[1, 2].map((g) => (
              <div key={g}>
                <div style={{ height: "18px", width: "160px", borderRadius: "6px", background: "rgba(255,255,255,0.05)", marginBottom: "12px" }} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "10px" }}>
                  {[1, 2, 3, 4].map((c) => (
                    <div key={c} style={{ aspectRatio: "2/3", borderRadius: "10px", background: "rgba(255,255,255,0.04)", animation: "pulse 1.5s ease-in-out infinite" }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        {!loading && groups.map((group) => (
          <div key={group.date} style={{ marginBottom: "28px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#F5B548", letterSpacing: "0.04em" }}>
                {group.label}
              </div>
              <div style={{ flex: 1, height: "1px", background: "rgba(245,181,72,0.12)" }} />
              <div style={{ fontSize: "12px", color: "rgba(240,234,214,0.3)" }}>
                {group.issues.length} issue{group.issues.length !== 1 ? "s" : ""}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "10px" }}>
              {group.issues.map((issue) => (
                <IssueCard
                  key={issue.id}
                  issue={issue}
                  wishlisted={wishlistIds.has(issue.id)}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Pagination */}
        {result && (result.hasMore || currentPage > 1) && (
          <div style={{ display: "flex", justifyContent: "center", gap: "12px", marginTop: "8px" }}>
            {currentPage > 1 && (
              <button
                onClick={() => handleSearch(currentPage - 1)}
                style={{
                  padding: "10px 20px", borderRadius: "10px",
                  border: "1px solid rgba(245,181,72,0.2)", background: "transparent",
                  color: "#F5B548", fontWeight: 600, cursor: "pointer", fontSize: "14px",
                }}
              >
                Prev
              </button>
            )}
            {result.hasMore && (
              <button
                onClick={() => handleSearch(currentPage + 1)}
                style={{
                  padding: "10px 20px", borderRadius: "10px",
                  border: "1px solid rgba(245,181,72,0.2)", background: "rgba(245,181,72,0.08)",
                  color: "#F5B548", fontWeight: 600, cursor: "pointer", fontSize: "14px",
                }}
              >
                Load more
              </button>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
