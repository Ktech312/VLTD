"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Image from "next/image";
import {
  fetchAllSources,
  groupByYear,
  formatStoreDate,
  roleLabel,
  isCoverOnlyRole,
  type UpcomingIssue,
  type UpcomingComicsResult,
} from "@/lib/comicUpcoming";
import {
  COMIC_STATUS_LABEL,
  loadComicStatuses,
  setComicStatus,
  type ComicStatus,
} from "@/lib/comicWishlistModel";
import { showToast } from "@/lib/toast";

const STATUS_ORDER: ComicStatus[] = ["want", "preordered", "own"];
// Short labels so all three fit one row on a 140px card.
const CARD_LABEL: Record<ComicStatus, string> = { want: "Want", preordered: "Ordered", own: "Own" };

/* ── Publisher pills ──────────────────────────────────────────── */

const ALL_PUBLISHERS = [
  { label: "Marvel",     value: "Marvel" },
  { label: "DC",         value: "DC Comics" },
  { label: "Dark Horse", value: "Dark Horse Comics" },
  { label: "Image",      value: "Image Comics" },
  { label: "IDW",        value: "IDW Publishing" },
  { label: "BOOM!",      value: "BOOM! Studios" },
];

/* ── Issue card ──────────────────────────────────────────────── */

function IssueCard({
  issue,
  status,
  onStatus,
}: {
  issue: UpcomingIssue;
  status: ComicStatus | null;
  onStatus: (issue: UpcomingIssue, status: ComicStatus | null) => void;
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
        border: "1px solid rgba(203,208,213,0.10)",
        borderRadius: "12px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        textDecoration: "none",
        cursor: "pointer",
        transition: "border-color 0.15s",
        height: "100%",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(203,208,213,0.30)")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(203,208,213,0.10)")}
    >
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

        {issue.isVariant && (
          <div style={{
            position: "absolute", top: "6px", left: "6px",
            background: "rgba(180,100,220,0.85)", backdropFilter: "blur(4px)",
            borderRadius: "4px", padding: "2px 6px",
            fontSize: "9px", fontWeight: 700, color: "#fff", letterSpacing: "0.05em",
          }}>VARIANT</div>
        )}

      </div>

      <div style={{ padding: "9px 9px 11px", display: "flex", flexDirection: "column", gap: "3px", flex: 1 }}>
        <div style={{
          fontSize: "12px", fontWeight: 700, color: "#ECEDEF", lineHeight: 1.3,
          overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        }}>
          {issue.series}
        </div>
        <div style={{ fontSize: "11px", color: "rgba(203,208,213,0.75)", fontWeight: 600 }}>
          #{issue.number}
        </div>

        {role && (
          <span style={{
            fontSize: "9px", fontWeight: 700, alignSelf: "flex-start",
            color: isCoverOnly ? "rgba(180,100,220,0.9)" : "rgba(100,200,140,0.9)",
            background: isCoverOnly ? "rgba(180,100,220,0.12)" : "rgba(100,200,140,0.10)",
            border: isCoverOnly ? "1px solid rgba(180,100,220,0.25)" : "1px solid rgba(100,200,140,0.20)",
            borderRadius: "4px", padding: "1px 4px",
          }}>{role}</span>
        )}

        <div style={{ marginTop: "auto", paddingTop: "3px", display: "flex", flexDirection: "column", gap: "1px" }}>
          {issue.storeDate && (
            <div style={{ fontSize: "10px", color: "rgba(203,208,213,0.45)", fontWeight: 500 }}>
              {formatStoreDate(issue.storeDate)}
            </div>
          )}
          {/* Want / Pre-ordered / Own -- tap the lit one again to clear it. */}
          <div role="group" aria-label="My status" style={{ display: "flex", gap: "3px", margin: "3px 0 2px" }}>
            {STATUS_ORDER.map((s) => {
              const on = status === s;
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={on}
                  title={COMIC_STATUS_LABEL[s]}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onStatus(issue, on ? null : s); }}
                  style={{
                    padding: "2px 4px", borderRadius: "100px", fontSize: "9px", fontWeight: 700,
                    whiteSpace: "nowrap", cursor: "pointer", transition: "all 0.15s",
                    border: on ? "1px solid #C8CDD2" : "1px solid rgba(255,255,255,0.14)",
                    background: on ? "rgba(203,208,213,0.18)" : "transparent",
                    color: on ? "#ECEDEF" : "rgba(240,234,214,0.5)",
                  }}
                >{CARD_LABEL[s]}</button>
              );
            })}
          </div>
          <div style={{
            fontSize: "10px", color: "rgba(255,255,255,0.25)",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {issue.publisher}
          </div>
        </div>
      </div>
    </a>
  );
}

/* ── Main page ───────────────────────────────────────────────── */

export default function UpcomingPage() {
  const [mode, setMode]               = useState<"creator" | "series">("creator");
  const [query, setQuery]             = useState("");
  const [selectedPubs, setSelectedPubs] = useState<Set<string>>(new Set());
  const [days, setDays]               = useState(90);
  const [allMode, setAllMode]         = useState(false);
  const [loading, setLoading]         = useState(true); // initial browse load
  const [loadingMore, setLoadingMore] = useState(false);
  const [fedResult, setFedResult]     = useState<UpcomingComicsResult | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [statuses, setStatuses]       = useState<Map<number, ComicStatus>>(new Map());
  const [saving, setSaving]           = useState<Set<number>>(new Set());
  const [notFound, setNotFound]       = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadComicStatuses().then(setStatuses).catch(() => {});
  }, []);

  // Open on the full upcoming list, like a comic shop's pre-order page.
  // Same request the Search button sends with an empty box.
  useEffect(() => {
    let cancelled = false;
    fetchAllSources({ days: 90, page: 1, pageSize: 25 }).then((data) => {
      if (cancelled) return;
      setLoading(false);
      if (!data) return;
      setFedResult((prev) => prev ?? data);
      setCurrentPage(1);
    });
    return () => { cancelled = true; };
  }, []);

  /**
   * pubOverride: undefined = use current selectedPubs; null = no filter; string = specific publisher
   */
  async function handleSearch(pg = 1, pubOverride?: string | null) {
    const q = query.trim();
    // No name = browse everything releasing in the window (soonest first).
    // Never browse the whole back catalog unfiltered.
    if (!q && allMode) return;

    const isLoadMore = pg > 1;
    if (isLoadMore) setLoadingMore(true);
    else { setLoading(true); setNotFound(false); }

    const singlePub =
      pubOverride !== undefined
        ? (pubOverride ?? undefined)
        : selectedPubs.size === 1
        ? Array.from(selectedPubs)[0]
        : undefined;

    const opts = {
      days: allMode ? undefined : days,
      all: allMode || undefined,
      page: pg,
      pageSize: 25,
      publisher: singlePub,
      ...(q ? (mode === "creator" ? { creator: q } : { series: q }) : {}),
    };

    const data = await fetchAllSources(opts);

    if (!data || (data.results.length === 0 && pg === 1)) {
      if (!isLoadMore) { setFedResult(null); setNotFound(true); }
    } else if (data && isLoadMore && fedResult) {
      setFedResult({ ...data, results: [...fedResult.results, ...data.results] });
      setCurrentPage(pg);
    } else if (data) {
      setFedResult(data as UpcomingComicsResult);
      setCurrentPage(pg);
    }

    if (isLoadMore) setLoadingMore(false);
    else setLoading(false);
  }

  async function handleStatus(issue: UpcomingIssue, next: ComicStatus | null) {
    if (saving.has(issue.id)) return;
    const prev = statuses.get(issue.id) ?? null;
    const apply = (value: ComicStatus | null) =>
      setStatuses((m) => { const n = new Map(m); if (value) n.set(issue.id, value); else n.delete(issue.id); return n; });
    apply(next);
    setSaving((p) => new Set(p).add(issue.id));
    const res = await setComicStatus(issue, next);
    if (!res.ok) {
      apply(prev);
      showToast(res.needsSql ? "Pre-ordered and Own need the comic status SQL run first. Want works now." : "Couldn't save that. Try again.");
    }
    setSaving((p) => { const n = new Set(p); n.delete(issue.id); return n; });
  }


  function togglePub(value: string) {
    const next = new Set(selectedPubs);
    if (next.has(value)) next.delete(value); else next.add(value);
    // If all individually selected → snap to "All" (no filter)
    if (next.size === ALL_PUBLISHERS.length) {
      setSelectedPubs(new Set());
      if (fedResult) handleSearch(1, null);
      return;
    }
    setSelectedPubs(next);
    if (fedResult) {
      if (next.size === 1) handleSearch(1, Array.from(next)[0]); // server-side filter
      else if (next.size === 0) handleSearch(1, null);           // clear filter
      // 2+ selected: client-side filter only (no re-fetch)
    }
  }

  const filteredResults = useMemo(() => {
    if (!fedResult) return [];
    if (selectedPubs.size === 0 || selectedPubs.size === 1) return fedResult.results; // server filtered or unfiltered
    return fedResult.results.filter((issue) =>
      Array.from(selectedPubs).some((pub) =>
        issue.publisher.toLowerCase().includes(pub.toLowerCase())
      )
    );
  }, [fedResult, selectedPubs]);

  const groups       = useMemo(() => groupByYear(filteredResults, allMode ? "desc" : "asc"), [filteredResults, allMode]);
  const totalCount   = fedResult?.count ?? 0;
  const shownCount   = filteredResults.length;
  const variantCount = filteredResults.filter((r) => r.isVariant).length;
  const creatorName  = fedResult?.resolvedCreator?.name;

  return (
    <div className="vltd-dark-surface" style={{
      minHeight: "100dvh", background: "#0A0A12", color: "#ECEDEF",
      paddingTop: "env(safe-area-inset-top, 0px)",
      paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 90px)",
    }}>
      {/* ── Sticky header ─── */}
      <div style={{
        position: "sticky", top: 0, zIndex: 40,
        background: "rgba(10,10,18,0.95)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(203,208,213,0.08)",
        padding: "16px 16px 12px",
      }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>

          <div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginBottom: "14px" }}>
            <span style={{ fontSize: "22px", fontWeight: 900, letterSpacing: "-0.02em" }}>Upcoming Comics</span>
            {statuses.size > 0 && (
              <span style={{
                fontSize: "12px", fontWeight: 700, color: "#C8CDD2",
                background: "rgba(203,208,213,0.12)", border: "1px solid rgba(203,208,213,0.25)",
                borderRadius: "100px", padding: "2px 9px",
              }}>{statuses.size} saved</span>
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
                  background: mode === m ? "#C8CDD2" : "transparent",
                  color: mode === m ? "#0A0A12" : "rgba(240,234,214,0.55)",
                }}>{m === "creator" ? "By Artist" : "By Series"}</button>
            ))}
          </div>

          {/* Search bar */}
          <form onSubmit={(e) => { e.preventDefault(); handleSearch(1); }}
            style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
            <input
              ref={inputRef} type="text" value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={mode === "creator" ? "Artist name — e.g. Peach Momoko" : "Series title — e.g. Demon Days"}
              style={{
                flex: 1, background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(203,208,213,0.20)", borderRadius: "10px",
                padding: "11px 14px", fontSize: "15px", color: "#ECEDEF", outline: "none",
              }}
            />
            <button type="submit" disabled={loading}
              style={{
                background: "#C8CDD2", border: "none", borderRadius: "10px",
                padding: "11px 18px", fontSize: "14px", fontWeight: 700,
                color: "#0A0A12", cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.6 : 1, whiteSpace: "nowrap",
              }}>{loading ? "…" : "Search"}</button>
          </form>

          {/* Publisher pills + days */}
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
            <button
              onClick={() => { setSelectedPubs(new Set()); if (fedResult) handleSearch(1, null); }}
              style={{
                padding: "5px 12px", borderRadius: "100px", fontSize: "12px", fontWeight: 600,
                border: selectedPubs.size === 0 ? "1px solid #C8CDD2" : "1px solid rgba(255,255,255,0.12)",
                background: selectedPubs.size === 0 ? "rgba(203,208,213,0.12)" : "transparent",
                color: selectedPubs.size === 0 ? "#C8CDD2" : "rgba(240,234,214,0.55)",
                cursor: "pointer", transition: "all 0.15s",
              }}>All</button>

            {ALL_PUBLISHERS.map((p) => (
              <button key={p.value} onClick={() => togglePub(p.value)}
                style={{
                  padding: "5px 12px", borderRadius: "100px", fontSize: "12px", fontWeight: 600,
                  border: selectedPubs.has(p.value) ? "1px solid #C8CDD2" : "1px solid rgba(255,255,255,0.12)",
                  background: selectedPubs.has(p.value) ? "rgba(203,208,213,0.12)" : "transparent",
                  color: selectedPubs.has(p.value) ? "#C8CDD2" : "rgba(240,234,214,0.55)",
                  cursor: "pointer", transition: "all 0.15s",
                }}>{p.label}</button>
            ))}

            <div style={{ marginLeft: "auto", display: "flex", gap: "4px" }}>
              {[30, 60, 90, 180].map((d) => (
                <button key={d} onClick={() => { setDays(d); setAllMode(false); }}
                  style={{
                    padding: "5px 10px", borderRadius: "100px", fontSize: "11px", fontWeight: 600,
                    border: !allMode && days === d ? "1px solid rgba(203,208,213,0.5)" : "1px solid rgba(255,255,255,0.08)",
                    background: !allMode && days === d ? "rgba(203,208,213,0.08)" : "transparent",
                    color: !allMode && days === d ? "rgba(203,208,213,0.8)" : "rgba(240,234,214,0.35)",
                    cursor: "pointer",
                  }}>{d}d</button>
              ))}
              <button onClick={() => setAllMode((v) => !v)}
                style={{
                  padding: "5px 10px", borderRadius: "100px", fontSize: "11px", fontWeight: 600,
                  border: allMode ? "1px solid rgba(203,208,213,0.5)" : "1px solid rgba(255,255,255,0.08)",
                  background: allMode ? "rgba(203,208,213,0.08)" : "transparent",
                  color: allMode ? "rgba(203,208,213,0.8)" : "rgba(240,234,214,0.35)",
                  cursor: "pointer",
                }}>All</button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ─── */}
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "16px" }}>

        {/* Banner */}
        {fedResult && (
          <div style={{
            background: "rgba(203,208,213,0.06)", border: "1px solid rgba(203,208,213,0.14)",
            borderRadius: "10px", padding: "10px 14px", marginBottom: "14px",
            fontSize: "13px", color: "rgba(203,208,213,0.85)",
          }}>
            {creatorName && <><strong style={{ color: "#C8CDD2" }}>{creatorName}</strong>{" · "}</>}
            {selectedPubs.size > 1
              ? <>{shownCount} shown of {totalCount} total</>
              : <>{totalCount} issue{totalCount !== 1 ? "s" : ""}</>}
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
              {mode === "creator" ? "Try the full name — e.g. \"Peach Momoko\" not just \"Momoko\""
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
              <span style={{ color: "rgba(203,208,213,0.6)" }}>Metron</span>.
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
                    <div key={c} style={{ flexShrink: 0, width: "140px", aspectRatio: "2/3", borderRadius: "10px", background: "rgba(255,255,255,0.04)", animation: "pulse 1.5s ease-in-out infinite" }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Year rows */}
        {!loading && groups.map((group) => (
          <div key={group.year} style={{ marginBottom: "28px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
              <div style={{ fontSize: "14px", fontWeight: 800, color: "#C8CDD2", letterSpacing: "0.06em" }}>
                {group.year}
              </div>
              <div style={{ flex: 1, height: "1px", background: "rgba(203,208,213,0.12)" }} />
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
                  <IssueCard issue={issue} status={statuses.get(issue.id) ?? null} onStatus={handleStatus} />
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Load more */}
        {!loading && fedResult?.hasMore && (
          <div style={{ textAlign: "center", paddingBottom: "16px" }}>
            <button
              onClick={() => handleSearch(currentPage + 1)}
              disabled={loadingMore}
              style={{
                background: "transparent", border: "1px solid rgba(203,208,213,0.30)",
                borderRadius: "10px", padding: "10px 28px",
                fontSize: "13px", fontWeight: 600, color: "#C8CDD2",
                cursor: loadingMore ? "not-allowed" : "pointer",
                opacity: loadingMore ? 0.6 : 1, transition: "all 0.15s",
              }}
            >{loadingMore ? "Loading…" : `Load more (${totalCount - shownCount} remaining)`}</button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.7} }
        .year-row::-webkit-scrollbar { display: none }
      `}</style>
    </div>
  );
}
