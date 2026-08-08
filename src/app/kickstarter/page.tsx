"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import type { KickstarterProject } from "@/app/api/kickstarter-comics/route";
import { Glyph } from "@/components/ui/Glyph";

/* ── Kickstarter Campaign Card ───────────────────────────────── */

function CampaignCard({ project }: { project: KickstarterProject }) {
  const [imgError, setImgError] = useState(false);
  const daysLeft = project.deadline
    ? Math.max(
        0,
        Math.ceil(
          (new Date(project.deadline).getTime() - Date.now()) / 86_400_000
        )
      )
    : null;

  const isLive = project.state === "live";
  const isFunded = project.percentFunded >= 100;

  return (
    <a
      href={project.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "flex",
        flexDirection: "column",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(203,208,213,0.10)",
        borderRadius: "14px",
        overflow: "hidden",
        textDecoration: "none",
        transition: "border-color 0.15s",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.borderColor = "rgba(203,208,213,0.30)")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.borderColor = "rgba(203,208,213,0.10)")
      }
    >
      {/* Cover image */}
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "16/9",
          background: "#111",
        }}
      >
        {project.imageUrl && !imgError ? (
          <Image
            src={project.imageUrl}
            alt={project.name}
            fill
            sizes="(max-width: 640px) 100vw, 320px"
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
              background: "linear-gradient(145deg,#1a1a2e,#0d0d1a)",
            }}
          >
            <span style={{ opacity: 0.3 }}><Glyph name="palette" size={32} /></span>
          </div>
        )}

        {/* State badge */}
        <div
          style={{
            position: "absolute",
            top: "8px",
            left: "8px",
            background: isLive
              ? "rgba(80,200,80,0.85)"
              : "rgba(120,120,120,0.85)",
            backdropFilter: "blur(4px)",
            borderRadius: "6px",
            padding: "2px 8px",
            fontSize: "10px",
            fontWeight: 700,
            color: "#fff",
            letterSpacing: "0.05em",
          }}
        >
          {isLive ? "LIVE" : project.state.toUpperCase()}
        </div>

        {/* Days left */}
        {isLive && daysLeft !== null && (
          <div
            style={{
              position: "absolute",
              top: "8px",
              right: "8px",
              background: "rgba(0,0,0,0.75)",
              backdropFilter: "blur(4px)",
              borderRadius: "6px",
              padding: "2px 8px",
              fontSize: "10px",
              fontWeight: 700,
              color: daysLeft <= 3 ? "#FF6B6B" : "#ECEDEF",
            }}
          >
            {daysLeft === 0 ? "Last day!" : `${daysLeft}d left`}
          </div>
        )}
      </div>

      {/* Info */}
      <div
        style={{
          padding: "12px 14px 14px",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          flex: 1,
        }}
      >
        <div
          style={{
            fontSize: "13px",
            fontWeight: 700,
            color: "#ECEDEF",
            lineHeight: 1.35,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {project.name}
        </div>

        <div style={{ fontSize: "11px", color: "rgba(203,208,213,0.65)" }}>
          by {project.creator}
        </div>

        <div
          style={{
            fontSize: "11px",
            color: "rgba(240,234,214,0.4)",
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {project.blurb}
        </div>

        {/* Progress bar */}
        <div style={{ marginTop: "auto", paddingTop: "6px" }}>
          <div
            style={{
              height: "4px",
              borderRadius: "2px",
              background: "rgba(255,255,255,0.08)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${Math.min(100, project.percentFunded)}%`,
                background: isFunded
                  ? "linear-gradient(90deg,#50C850,#80E880)"
                  : "linear-gradient(90deg,#C8CDD2,#EDEFF1)",
                borderRadius: "2px",
                transition: "width 0.3s",
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: "4px",
            }}
          >
            <span
              style={{
                fontSize: "10px",
                fontWeight: 700,
                color: isFunded ? "#50C850" : "#C8CDD2",
              }}
            >
              {project.percentFunded.toLocaleString()}% funded
            </span>
            <span style={{ fontSize: "10px", color: "rgba(240,234,214,0.35)" }}>
              {project.backers.toLocaleString()} backers
            </span>
          </div>
        </div>
      </div>
    </a>
  );
}

/* ── Kickstarter Comics Page ─────────────────────────────────── */

const SORT_OPTIONS = [
  { value: "magic", label: "Recommended" },
  { value: "newest", label: "Newest" },
  { value: "end_date", label: "Ending soon" },
  { value: "most_funded", label: "Most funded" },
  { value: "most_backed", label: "Most backed" },
];

export default function KickstarterPage() {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("magic");
  const [projects, setProjects] = useState<KickstarterProject[]>([]);
  const [totalHits, setTotalHits] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function doSearch(pg = 1, term?: string, sortBy?: string) {
    const q = term ?? query;
    const s = sortBy ?? sort;
    const isLoadMore = pg > 1;

    if (isLoadMore) setLoadingMore(true);
    else { setLoading(true); setError(null); }

    const params = new URLSearchParams({ q, sort: s, page: String(pg) });
    const res = await fetch(`/api/kickstarter-comics?${params}`);
    const json = await res.json();

    if (!res.ok || json.error) {
      setError(json.error ?? "Failed to load campaigns");
      if (!isLoadMore) setProjects([]);
    } else {
      if (isLoadMore) {
        setProjects((prev) => [...prev, ...(json.projects ?? [])]);
      } else {
        setProjects(json.projects ?? []);
      }
      setTotalHits(json.total_hits ?? 0);
      setPage(pg);
      setHasMore(json.hasMore ?? false);
      setSearched(true);
    }

    if (isLoadMore) setLoadingMore(false);
    else setLoading(false);
  }

  function handleSortChange(newSort: string) {
    setSort(newSort);
    if (searched) doSearch(1, query, newSort);
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#0A0A12",
        color: "#ECEDEF",
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
          borderBottom: "1px solid rgba(203,208,213,0.08)",
          padding: "16px 16px 12px",
        }}
      >
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "10px",
              marginBottom: "14px",
            }}
          >
            <span
              style={{
                fontSize: "22px",
                fontWeight: 900,
                letterSpacing: "-0.02em",
              }}
            >
              Kickstarter Comics
            </span>
            <span
              style={{
                fontSize: "12px",
                color: "rgba(240,234,214,0.35)",
                fontWeight: 500,
              }}
            >
              Active campaigns
            </span>
          </div>

          {/* Search bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              doSearch(1);
            }}
            style={{ display: "flex", gap: "8px", marginBottom: "10px" }}
          >
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search — e.g. superhero, Peach Momoko, horror anthology…"
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(203,208,213,0.20)",
                borderRadius: "10px",
                padding: "11px 14px",
                fontSize: "15px",
                color: "#ECEDEF",
                outline: "none",
              }}
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                background: "#05CE78",
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
              {loading ? "…" : "Search"}
            </button>
          </form>

          {/* Sort pills */}
          <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
            {SORT_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => handleSortChange(o.value)}
                style={{
                  padding: "4px 11px",
                  borderRadius: "100px",
                  fontSize: "11px",
                  fontWeight: 600,
                  border:
                    sort === o.value
                      ? "1px solid #05CE78"
                      : "1px solid rgba(255,255,255,0.10)",
                  background:
                    sort === o.value ? "rgba(5,206,120,0.12)" : "transparent",
                  color:
                    sort === o.value ? "#05CE78" : "rgba(240,234,214,0.45)",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div
        style={{ maxWidth: "900px", margin: "0 auto", padding: "16px" }}
      >
        {/* Error */}
        {error && (
          <div
            style={{
              background: "rgba(220,60,60,0.08)",
              border: "1px solid rgba(220,60,60,0.20)",
              borderRadius: "10px",
              padding: "12px 16px",
              marginBottom: "16px",
              fontSize: "13px",
              color: "rgba(255,120,120,0.9)",
            }}
          >
            {error}
          </div>
        )}

        {/* Results count */}
        {searched && !loading && (
          <div
            style={{
              fontSize: "12px",
              color: "rgba(203,208,213,0.7)",
              marginBottom: "14px",
            }}
          >
            {totalHits.toLocaleString()} campaign
            {totalHits !== 1 ? "s" : ""} found in Comics
          </div>
        )}

        {/* Empty / prompt */}
        {!searched && !loading && (
          <div
            style={{
              textAlign: "center",
              padding: "60px 20px",
              color: "rgba(240,234,214,0.30)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "14px" }}>
              <Glyph name="rocket" size={44} />
            </div>
            <div
              style={{
                fontSize: "16px",
                fontWeight: 600,
                marginBottom: "6px",
                color: "rgba(240,234,214,0.5)",
              }}
            >
              Discover crowdfunded comics
            </div>
            <div style={{ fontSize: "13px", lineHeight: 1.6 }}>
              Search active Kickstarter campaigns — independent titles,
              artist-owned books, and genre gems that won&apos;t be in stores.
            </div>
            <button
              onClick={() => { setQuery("comics"); doSearch(1, "comics"); }}
              style={{
                marginTop: "20px",
                background: "rgba(5,206,120,0.12)",
                border: "1px solid rgba(5,206,120,0.30)",
                borderRadius: "10px",
                padding: "10px 22px",
                fontSize: "13px",
                fontWeight: 600,
                color: "#05CE78",
                cursor: "pointer",
              }}
            >
              Browse all comics campaigns
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: "14px",
            }}
          >
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                style={{
                  borderRadius: "14px",
                  overflow: "hidden",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(203,208,213,0.06)",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    aspectRatio: "16/9",
                    background: "rgba(255,255,255,0.04)",
                    animation: "pulse 1.5s ease-in-out infinite",
                  }}
                />
                <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ height: "14px", borderRadius: "4px", background: "rgba(255,255,255,0.05)", animation: "pulse 1.5s ease-in-out infinite" }} />
                  <div style={{ height: "10px", width: "60%", borderRadius: "4px", background: "rgba(255,255,255,0.04)", animation: "pulse 1.5s ease-in-out infinite" }} />
                  <div style={{ height: "4px", borderRadius: "2px", background: "rgba(255,255,255,0.04)", animation: "pulse 1.5s ease-in-out infinite" }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Results grid */}
        {!loading && projects.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: "14px",
            }}
          >
            {projects.map((p) => (
              <CampaignCard key={p.id} project={p} />
            ))}
          </div>
        )}

        {/* Load more */}
        {!loading && hasMore && (
          <div
            style={{
              textAlign: "center",
              paddingTop: "20px",
              paddingBottom: "16px",
            }}
          >
            <button
              onClick={() => doSearch(page + 1)}
              disabled={loadingMore}
              style={{
                background: "transparent",
                border: "1px solid rgba(5,206,120,0.30)",
                borderRadius: "10px",
                padding: "10px 28px",
                fontSize: "13px",
                fontWeight: 600,
                color: "#05CE78",
                cursor: loadingMore ? "not-allowed" : "pointer",
                opacity: loadingMore ? 0.6 : 1,
                transition: "all 0.15s",
              }}
            >
              {loadingMore ? "Loading…" : "Load more campaigns"}
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.7} }
      `}</style>
    </div>
  );
}
