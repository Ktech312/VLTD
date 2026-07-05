"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import type { PatreonCreator } from "@/app/api/patreon-comics/route";

/* ── Creator card ────────────────────────────────────────────── */

function CreatorCard({ creator }: { creator: PatreonCreator }) {
  const [imgError, setImgError] = useState(false);

  return (
    <a
      href={creator.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "flex",
        gap: "12px",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(245,181,72,0.10)",
        borderRadius: "14px",
        padding: "14px",
        textDecoration: "none",
        transition: "border-color 0.15s",
        alignItems: "flex-start",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.borderColor = "rgba(245,181,72,0.30)")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.borderColor = "rgba(245,181,72,0.10)")
      }
    >
      {/* Avatar */}
      <div
        style={{
          flexShrink: 0,
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          overflow: "hidden",
          background: "#1a1a2e",
          border: "2px solid rgba(245,181,72,0.15)",
        }}
      >
        {creator.imageUrl && !imgError ? (
          <Image
            src={creator.imageUrl}
            alt={creator.name}
            width={56}
            height={56}
            style={{ objectFit: "cover", width: "100%", height: "100%" }}
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
            <span style={{ fontSize: "22px", opacity: 0.5 }}>🎨</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "14px",
            fontWeight: 700,
            color: "#F0EAD6",
            marginBottom: "3px",
          }}
        >
          {creator.name}
        </div>

        {creator.blurb && (
          <div
            style={{
              fontSize: "12px",
              color: "rgba(240,234,214,0.45)",
              lineHeight: 1.45,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              marginBottom: "6px",
            }}
          >
            {creator.blurb}
          </div>
        )}

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {creator.patrons !== null && (
            <span
              style={{
                fontSize: "10px",
                fontWeight: 600,
                color: "#F5B548",
                background: "rgba(245,181,72,0.08)",
                border: "1px solid rgba(245,181,72,0.20)",
                borderRadius: "100px",
                padding: "2px 8px",
              }}
            >
              {creator.patrons.toLocaleString()} patrons
            </span>
          )}
          {creator.tierCount !== null && (
            <span
              style={{
                fontSize: "10px",
                color: "rgba(240,234,214,0.40)",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "100px",
                padding: "2px 8px",
              }}
            >
              {creator.tierCount} tier{creator.tierCount !== 1 ? "s" : ""}
            </span>
          )}
          {creator.isNSFW && (
            <span
              style={{
                fontSize: "10px",
                fontWeight: 700,
                color: "rgba(220,80,80,0.8)",
                background: "rgba(220,80,80,0.08)",
                border: "1px solid rgba(220,80,80,0.20)",
                borderRadius: "100px",
                padding: "2px 8px",
              }}
            >
              18+
            </span>
          )}
        </div>
      </div>

      {/* Arrow */}
      <div
        style={{
          flexShrink: 0,
          fontSize: "14px",
          color: "rgba(240,234,214,0.20)",
          marginTop: "4px",
        }}
      >
        →
      </div>
    </a>
  );
}

/* ── Patreon Comics Page ─────────────────────────────────────── */

export default function PatreonPage() {
  const [tab, setTab] = useState<"search" | "lookup">("search");
  const [query, setQuery] = useState("");
  const [lookupUrl, setLookupUrl] = useState("");
  const [creators, setCreators] = useState<PatreonCreator[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const queryRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);

  async function doSearch() {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setNote(null);

    const params = new URLSearchParams({ q: query.trim() });
    const res = await fetch(`/api/patreon-comics?${params}`);
    const json = await res.json();

    if (!res.ok || json.error) {
      setError(json.error ?? "Search failed");
      setCreators([]);
    } else {
      setCreators(json.creators ?? []);
      setNote(json.note ?? null);
      setSearched(true);
    }
    setLoading(false);
  }

  async function doLookup() {
    const raw = lookupUrl.trim();
    if (!raw) return;
    setLoading(true);
    setError(null);
    setNote(null);

    const params = new URLSearchParams({ url: raw });
    const res = await fetch(`/api/patreon-comics?${params}`);
    const json = await res.json();

    if (!res.ok || json.error) {
      setError(json.error ?? "Lookup failed");
      setCreators([]);
    } else {
      setCreators(json.creators ?? []);
      setSearched(true);
    }
    setLoading(false);
  }

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
        <div style={{ maxWidth: "700px", margin: "0 auto" }}>
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
              Patreon Comics
            </span>
            <span
              style={{
                fontSize: "12px",
                color: "rgba(240,234,214,0.35)",
                fontWeight: 500,
              }}
            >
              Creator support
            </span>
          </div>

          {/* Tab toggle */}
          <div
            style={{
              display: "flex",
              background: "rgba(255,255,255,0.05)",
              borderRadius: "10px",
              padding: "3px",
              width: "fit-content",
              marginBottom: "12px",
            }}
          >
            {(["search", "lookup"] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTab(t);
                  setCreators([]);
                  setSearched(false);
                  setError(null);
                  setNote(null);
                }}
                style={{
                  padding: "6px 18px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  background: tab === t ? "#F5B548" : "transparent",
                  color: tab === t ? "#0A0A12" : "rgba(240,234,214,0.55)",
                }}
              >
                {t === "search" ? "Browse Creators" : "Look Up Creator"}
              </button>
            ))}
          </div>

          {tab === "search" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                doSearch();
              }}
              style={{ display: "flex", gap: "8px" }}
            >
              <input
                ref={queryRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search Patreon — e.g. comic artist, manga, webcomic…"
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
                  background: "#FF424D",
                  border: "none",
                  borderRadius: "10px",
                  padding: "11px 18px",
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#fff",
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.6 : 1,
                  whiteSpace: "nowrap",
                }}
              >
                {loading ? "…" : "Search"}
              </button>
            </form>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                doLookup();
              }}
              style={{ display: "flex", gap: "8px" }}
            >
              <input
                ref={urlRef}
                type="text"
                value={lookupUrl}
                onChange={(e) => setLookupUrl(e.target.value)}
                placeholder="Patreon URL or username — e.g. patreon.com/peach_momoko"
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
                  background: "#FF424D",
                  border: "none",
                  borderRadius: "10px",
                  padding: "11px 18px",
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#fff",
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.6 : 1,
                  whiteSpace: "nowrap",
                }}
              >
                {loading ? "…" : "Look up"}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Body */}
      <div
        style={{ maxWidth: "700px", margin: "0 auto", padding: "16px" }}
      >
        {/* Error */}
        {error && (
          <div
            style={{
              background: "rgba(220,60,60,0.08)",
              border: "1px solid rgba(220,60,60,0.20)",
              borderRadius: "10px",
              padding: "12px 16px",
              marginBottom: "14px",
              fontSize: "13px",
              color: "rgba(255,120,120,0.9)",
            }}
          >
            {error}
          </div>
        )}

        {/* Note (e.g. client-rendered warning) */}
        {note && (
          <div
            style={{
              background: "rgba(245,181,72,0.06)",
              border: "1px solid rgba(245,181,72,0.15)",
              borderRadius: "10px",
              padding: "10px 14px",
              marginBottom: "14px",
              fontSize: "12px",
              color: "rgba(245,181,72,0.75)",
            }}
          >
            ℹ️ {note}
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
            <div style={{ fontSize: "48px", marginBottom: "14px" }}>🎨</div>
            <div
              style={{
                fontSize: "16px",
                fontWeight: 600,
                marginBottom: "6px",
                color: "rgba(240,234,214,0.5)",
              }}
            >
              {tab === "search"
                ? "Find comic creators on Patreon"
                : "Look up a specific creator"}
            </div>
            <div style={{ fontSize: "13px", lineHeight: 1.6 }}>
              {tab === "search"
                ? "Support independent artists directly — exclusive pages, behind-the-scenes, and subscriber-only issues."
                : "Paste a Patreon URL or username to see campaign details, patron count, and tier info."}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: "12px",
                  padding: "14px",
                  borderRadius: "14px",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(245,181,72,0.06)",
                }}
              >
                <div
                  style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.06)",
                    animation: "pulse 1.5s ease-in-out infinite",
                    flexShrink: 0,
                  }}
                />
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <div
                    style={{
                      height: "14px",
                      width: "40%",
                      borderRadius: "4px",
                      background: "rgba(255,255,255,0.06)",
                      animation: "pulse 1.5s ease-in-out infinite",
                    }}
                  />
                  <div
                    style={{
                      height: "10px",
                      width: "80%",
                      borderRadius: "4px",
                      background: "rgba(255,255,255,0.04)",
                      animation: "pulse 1.5s ease-in-out infinite",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        {!loading && creators.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div
              style={{
                fontSize: "12px",
                color: "rgba(245,181,72,0.65)",
                marginBottom: "6px",
              }}
            >
              {creators.length} creator{creators.length !== 1 ? "s" : ""} found
            </div>
            {creators.map((c, i) => (
              <CreatorCard key={`${c.url}-${i}`} creator={c} />
            ))}
          </div>
        )}

        {/* No results */}
        {searched && !loading && creators.length === 0 && !error && (
          <div
            style={{
              textAlign: "center",
              padding: "40px 20px",
              color: "rgba(240,234,214,0.35)",
            }}
          >
            <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "8px" }}>
              No results found
            </div>
            <div style={{ fontSize: "12px", lineHeight: 1.6 }}>
              Patreon&apos;s search is JavaScript-rendered — try the{" "}
              <button
                onClick={() => setTab("lookup")}
                style={{
                  background: "none",
                  border: "none",
                  color: "#F5B548",
                  cursor: "pointer",
                  fontSize: "12px",
                  padding: 0,
                  textDecoration: "underline",
                }}
              >
                direct lookup
              </button>{" "}
              with a creator URL instead.
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.7} }
      `}</style>
    </div>
  );
}
