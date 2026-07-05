"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Image from "next/image";
import {
  fetchAllSources,
  groupByYear,
  roleLabel,
  isCoverOnlyRole,
  type UpcomingIssue,
  type UpcomingComicsResult,
} from "@/lib/comicUpcoming";
import {
  loadWishlistedIds,
  toggleComicWishlist,
} from "@/lib/comicWishlistModel";

/* ── Publisher pills ──────────────────────────────────────────── */

const ALL_PUBLISHERS = [
  { label: "Marvel",     value: "Marvel" },
  { label: "DC",         value: "DC Comics" },
  { label: "Dark Horse", value: "Dark Horse Comics" },
  { label: "Image",      value: "Image Comics" },
  { label: "IDW",        value: "IDW Publishing" },
  { label: "BOOM!",      value: "BOOM! Studios" },
];

/* ── Issue card ────────────────────────────────────────────────────── */

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
  const role = roleLabel(issue.creatorRole);
  const isCoverOnly = isCoverOnlyRole(issue.creatorRole);

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
        height: "100%",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(245,181,72,0.30)")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(245,181,72,0.10)")}
    >
      {/* Cover image */}
      <div style={{ position: "relative", width: "100%", aspectRatio: "2/3", background: "#111", flexShrink: 0 }}>
        {issue.imageUrl && !imgError ? (
          <Image
            src={issue.imageUrl}
            alt={`${issue.series} #${issue.number}`}
            fill
            sizes="(max-width: 640px) 45vw, 160px"
            style={{ objectFit: "cover" }}
            onError={() => setImgError(true)}
            unoptimized
          />
        ) : (
          <div style={{
            width: "100%", height: "100%", display: "flex", alignItems: "center",
            justifyContent: "center", background: "linear-gradient(145deg, #1a1a2e 0%, #0d0d1a 100%)",
          }}>
            <span style={{ fontSize: "32px", opacity: 0.3 }}>&#128218;</span>
          </div>
        )}

        {/* Variant ribbon */}
        {issue.isVariant && (
          <div style={{
            position: "absolute", top: "6px", left: "6px",
            background: "rgba(180,100,220,0.85)", backdropFilter: "blur(4px)",
            borderRadius: "4px", padding: "2px 6px",
            fontSize: "9px", fontWeight: 700, color: "#fff", letterSpacing: "0.05em",
          }}>
            VARIANT
          </div>
        )}

        {/* Heart / wishlist toggle */}
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(issue); }}
          aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
          style={{
            position: "absolute", top: "8px", right: "8px",
            width: "32px", height: "32px", borderRadius: "50%",
            border: wishlisted ? "1.5px solid #F5B548" : "1.5px solid rgba(255,255,255,0.25)",
            background: wishlisted ? "rgba(245,181,72,0.20)" : "rgba(0,0,0,0.55)",
            backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", transition: "all 0.15s",
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

      {/* Info */}
      <div style={{ padding: "9px 9px 11px", display: "flex", flexDirection: "column", gap: "3px", flex: 1 }}>
        <div style={{
          fontSize: "12px", fontWeight: 700, color: "#F0EAD6", lineHeight: 1.3,
          overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        }}>
          {issue.series}
        </div>
        <div style={{ fontSize: "11px", color: "rgba(245,181,72,0.75)", fontWeight: 600 }}>
          #{issue.number}
        </div>

        {/* Role badge */}
        {role && (
          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "1px" }}>
            <span style={{
              fontSize: "9px", fontWeight: 700,
              color: isCoverOnly ? "rgba(180,100,220,0.9)" : "rgba(100,200,140,0.9)",
              background: isCoverOnly ? "rgba(180,100,220,0.12)" : "rgba(100,200,140,0.10)",
              border: isCoverOnly ? "1px solid rgba(180,100,220,0.25)" : "1px solid rgba(100,200,140,0.20)",
              borderRadius: "4px", padding: "1px 4px",
            }}>
              {role}
            </span>
          </div>
        )}

        <div style={{
          fontSize: "10px", color: "rgba(255,255,255,0.30)", marginTop: "auto", paddingTop: "3px",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {issue.publisher}
        </div>
      </div>
    </a>
  );
}

/* ── Main page ─────────────────────────────────────────────────────── */

export default function UpcomingPage() {
  const [mode, setMode]           = useState<"creator" | "series">("creator");
  const [query, setQuery]         = useState("");
  const [selectedPubs, setSelectedPubs] = useState<Set<string>>(new Set());
  const [days, setDays]           = useState(90);
  const [allMode, setAllMode]     = useState(false);
  const [loading, setLoading]     = useState(false);
  const [fedResult, setFedResult] = useState<UpcomingComicsResult | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [wishlistIds, setWishlistIds] = useState<Set<number>>(new Set());
  const [toggling, setToggling]   = useState<Set<number>>(new Set());
  const [notFound, setNotFound]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadWishlistedIds().then(setWishlistIds).catch(() => {});
  }, []);

  async function handleSearch(pg = 1) {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setNotFound(false);

    const opts = {
      days: allMode ? undefined : days,
      all: allMode || undefined,
      page: pg,
      pageSize: 25,
      ...(mode === "creator" ? { creator: q } : { series: q }),
    };

    const data = await fetchAllSources(opts);

    if (!data || data.results.length === 0) {
      setFedResult(null);
      setNotFound(true);
    } else {
      setFedResult(data as UpcomingComicsResult);
      setCurrentPage(pg);
    }
    setLoading(false);
  }

  async function handleToggle(issue: UpcomingIssue) {
    if (toggling.has(issue.id)) return;
    const isWishlisted = wishlistIds.has(issue.id);

    setWishlistIds((prev) => {
      const next = new Set(prev);
      if (isWishlisted) next.delete(issue.id); else next.add(issue.id);
      return next;
    });
    setToggling((prev) => new Set(prev).add(issue.id));

    const { ok, nowWishlisted } = await toggleComicWishlist(issue, isWishlisted);

    if (!ok) {
      setWishlistIds((prev) => {
        const next = new Set(prev);
        if (isWishlisted) next.add(issue.id); else next.delete(issue.id);
        return next;
      });
    } else {
      setWishlistIds((prev) => {
        const next = new Set(prev);
        if (nowWishlisted) next.add(issue.id); else next.delete(issue.id);
        return next;
      });
    }

    setToggling((prev) => { const n = new Set(prev); n.delete(issue.id); return n; });
  }

  function togglePub(value: string) {
    setSelectedPubs((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value); else next.add(value);
      if (next.size === ALL_PUBLISHERS.length) return new Set(); // all selected = clear to "All"
      return next;
    });
  }

  const filteredResults = useMemo(() => {
    if (!fedResult) return [];
    if (selectedPubs.size === 0) return fedResult.results;
    return fedResult.results.filter((issue) =>
      Array.from(selectedPubs).some((pub) =>
        issue.publisher.toLowerCase().includes(pub.toLowerCase())
      )
    );
  }, [fedResult, selectedPubs]);

  const groups = useMemo(() => groupByYear(filteredResults), [filteredResults]);
  const totalCount = fedResult?.count ?? 0;
  const shownCount = filteredResults.length;
  const variantCount = filteredResults.filter((r) => r.isVariant).length;
  const creatorName = fedResult?.resolvedCreator?.name;

  return (
    <div style={{
      minHeight: "100dvh", background: "#0A0A12", color: "#F0EAD6",
      paddingTop: "env(safe-area-inset-top, 0px)",
      paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 90px)",
    }}>
      {/* ── Sticky header ─── */}
      <div style={{
        position: "sticky", top: 0, zIndex: 40,
        background: "rgba(10,10,18,0.95)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(245,181,72,0.08)",
        padding: "16px 16px 12px",
      }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>

          {/* Title */}
          <div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginBottom: "14px" }}>
            <span style={{ fontSize: "22px", fontWeight: 900, letterSpacing: "-0.02em" }}>
              Upcoming Comics
            </span>
            {wishlistIds.size > 0 && (
              <span style={{
                fontSize: "12px", fontWeight: 700, color: "#F5B548",
                background: "rgba(245,181,72,0.12)", border: "1px solid rgba(245,181,72,0.25)",
                borderRadius: "100px", padding: "2px 9px",
              }}>
                {wishlistIds.size} saved
              </span>
            )}
          </div>

          {/* Mode toggle */}
          <div style={{
            display: "flex", background: "rgba(255,255,255,0.05)",
            borderRadius: "10px", padding: "3px", marginBottom: "10px", width: "fit-content",
          }}>
            {(["creator", "series"] as const).map((m) => (
              <button key={m}
                onClick={() => { setMode(m); setFedResult(null); setNotFound(false); }}
                style={{
                  padding: "6px 18px", borderRadius: "8px", fontSize: "13px", fontWeight: 600,
                  border: "none", cursor: "pointer", transition: "all 0.15s",
                  background: mode === m ? "#F5B548" : "transparent",
                  color: mode === m ? "#0A0A12" : "rgba(240,234,214,0.55)",
                }}>
                {m === "creator" ? "By Artist" : "By Series"}
              </button>
            ))}
          </div>

          {/* Search bar */}
          <form onSubmit={(e) => { e.preventDefault(); handleSearch(1); }}
            style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={mode === "creator" ? "Artist name — e.g. Peach Momoko" : "Series title — e.g. Demon Days"}
              style={{
                flex: 1, background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(245,181,72,0.20)", borderRadius: "10px",
                padding: "11px 14px", fontSize: "15px", color: "#F0EAD6", outline: "none",
              }}
            />
            <button type="submit" disabled={loading}
              style={{
                background: "#F5B548", border: "none", borderRadius: "10px",
                padding: "11px 18px", fontSize: "14px", fontWeight: 700,
                color: "#0A0A12", cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.6 : 1, whiteSpace: "nowrap",
              }}>
              {loading ? "…" : "Search"}
            </button>
          </form>

          {/* Publisher pills + days */}
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
            {/* All pill */}
            <button onClick={() => setSelectedPubs(new Set())}
              style={{
                padding: "5px 12px", borderRadius: "100px", fontSize: "12px", fontWeight: 600,
                border: selectedPubs.size === 0 ? "1px solid #F5B548" : "1px solid rgba(255,255,255,0.12)",
                background: selectedPubs.size === 0 ? "rgba(245,181,72,0.12)" : "transparent",
                color: selectedPubs.size === 0 ? "#F5B548" : "rgba(240,234,214,0.55)",
                cursor: "pointer", transition: "all 0.15s",
              }}>All</button>

            {ALL_PUBLISHERS.map((p) => (
              <button key={p.value} onClick={() => togglePub(p.value)}
                style={{
                  padding: "5px 12px", borderRadius: "100px", fontSize: "12px", fontWeight: 600,
                  border: selectedPubs.has(p.value) ? "1px solid #F5B548" : "1px solid rgba(255,255,255,0.12)",
                  background: selectedPubs.has(p.value) ? "rgba(245,181,72,0.12)" : "transparent",
                  color: selectedPubs.has(p.value) ? "#F5B548" : "rgba(240,234,214,0.55)",
                  cursor: "pointer", transition: "all 0.15s",
                }}>
                {p.label}
              </button>
            ))}

            <div style={{ marginLeft: "auto", display: "flex", gap: "4px" }}>
              {[30, 60, 90, 180].map((d) => (
                <button key={d} onClick={() => { setDays(d); setAllMode(false); }}
                  style={{
                    padding: "5px 10px", borderRadius: "100px", fontSize: "11px", fontWeight: 600,
                    border: !allMode && days === d ? "1px solid rgba(245,181,72,0.5)" : "1px solid rgba(255,255,255,0.08)",
                    background: !allMode && days === d ? "rgba(245,181,72,0.08)" : "transparent",
                    color: !allMode && days === d ? "rgba(245,181,72,0.8)" : "rgba(240,234,214,0.35)",
                    cursor: "pointer",
                  }}>
                  {d}d
                </button>
              ))}
              <button onClick={() => setAllMode((v) => !v)}
                style={{
                  padding: "5px 10px", borderRadius: "100px", fontSize: "11px", fontWeight: 600,
                  border: allMode ? "1px solid rgba(245,181,72,0.5)" : "1px solid rgba(255,255,255,0.08)",
                  background: allMode ? "rgba(245,181,72,0.08)" : "transparent",
                  color: allMode ? "rgba(245,181,72,0.8)" : "rgba(240,234,214,0.35)",
                  cursor: "pointer",
                }}>
                All
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ─── */}
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "16px" }}>

        {/* Creator / count banner */}
        {fedResult && (
          <div style={{
            background: "rgba(245,181,72,0.06)", border: "1px solid rgba(245,181,72,0.14)",
            borderRadius: "10px", padding: "10px 14px", marginBottom: "14px",
            fontSize: "13px", color: "rgba(245,181,72,0.85)",
          }}>
            {creatorName ? (
              <>Showing work by <strong style={{ color: "#F5B548" }}>{creatorName}</strong>{" · "}</>
            ) : null}
            {selectedPubs.size > 0
              ? <>{shownCount} shown of {totalCount} total</>
              : <>{totalCount} issue{totalCount !== 1 ? "s" : ""}</>
            }
            {allMode ? " (all time)" : ` in next ${days} days`}
            {variantCount > 0 && (
              <> · <span style={{ color: "rgba(180,100,220,0.8)" }}>{variantCount} variant{variantCount !== 1 ? "s" : ""}</span></>
            )}
          </div>
        )}

        {/* Not found */}
        {notFound && !loading && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "rgba(240,234,214,0.35)" }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>&#128269;</div>
            <div style={{ fontSize: "16px", fontWeight: 600, marginBottom: "6px" }}>Nothing found</div>
            <div style={{ fontSize: "13px" }}>
              {mode === "creator"
                ? "Try the full name — e.g. \"Peach Momoko\" not just \"Momoko\""
                : "Try a partial title or check the publisher filter"}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!fedResult && !notFound && !loading && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "rgba(240,234,214,0.30)" }}>
            <div style={{ fontSize: "48px", marginBottom: "14px" }}>&#128197;</div>
            <div style={{ fontSize: "16px", fontWeight: 600, marginBottom: "6px", color: "rgba(240,234,214,0.5)" }}>
              Find what&apos;s dropping soon
            </div>
            <div style={{ fontSize: "13px", lineHeight: 1.6 }}>
              Search by artist or series — data from{" "}
              <span style={{ color: "rgba(245,181,72,0.6)" }}>Metron</span>.
              Variants are detected automatically.
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
            {[2026, 2025].map((y) => (
              <div key={y}>
                <div style={{ height: "16px", width: "60px", borderRadius: "6px", background: "rgba(255,255,255,0.05)", marginBottom: "10px" }} />
                <div style={{ display: "flex", gap: "10px", overflow: "hidden" }}>
                  {[1, 2, 3, 4, 5].map((c) => (
                    <div key={c} style={{ flexShrink: 0, width: "130px", aspectRatio: "2/3", borderRadius: "10px", background: "rgba(255,255,255,0.04)", animation: "pulse 1.5s ease-in-out infinite" }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Results — year rows with horizontal scroll */}
        {!loading && groups.map((group) => (
          <div key={group.year} style={{ marginBottom: "28px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
              <div style={{ fontSize: "14px", fontWeight: 800, color: "#F5B548", letterSpacing: "0.06em" }}>
                {group.year}
              </div>
              <div style={{ flex: 1, height: "1px", background: "rgba(245,181,72,0.12)" }} />
              <div style={{ fontSize: "11px", color: "rgba(240,234,214,0.3)" }}>
                {group.issues.length} issue{group.issues.length !== 1 ? "s" : ""}
              </div>
            </div>
            <div className="year-row" style={{
              display: "flex", overflowX: "auto", gap: "10px",
              paddingBottom: "8px", scrollSnapType: "x mandatory",
            }}>
              {group.issues.map((issue) => (
                <div key={issue.id} style={{ flexShrink: 0, width: "140px", scrollSnapAlign: "start" }}>
                  <IssueCard
                    issue={issue}
                    wishlisted={wishlistIds.has(issue.id)}
                    onToggle={handleToggle}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.7} }
        .year-row::-webkit-scrollbar { display: none }
      `}</style>
    </div>
  );
}
