"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

function formatExhibitSince(createdAt?: number): string | null {
  if (!createdAt) return null;
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;
  return "Exhibiting since " + date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/**
 * Lightweight curator popup for an ALIASED exhibition. Deliberately shows
 * only the alias name/avatar plus this exhibition's own item count — no
 * bio, no follower count, no Follow button, and no link to the curator's
 * real vault. CollectorBioModal (the real-identity version) is the one to
 * use for a non-aliased exhibition; this is its privacy-safe counterpart.
 */
export default function AliasCuratorModal({
  aliasName,
  aliasAvatar,
  itemCount,
  createdAt,
  onClose,
}: {
  aliasName: string;
  aliasAvatar: string;
  itemCount: number;
  createdAt?: number;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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

  const exhibitingSince = formatExhibitSince(createdAt);

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
          maxWidth: 380,
          borderRadius: 24,
          background: "#0E1420",
          border: "1px solid var(--border)",
          padding: 20,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="vltd-selectable bg-[color:var(--pill)] text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)] transition"
          style={{ position: "absolute", right: 14, top: 14, width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}
        >
          <svg viewBox="0 0 20 20" fill="none" style={{ width: 13, height: 13 }}>
            <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", paddingTop: 6 }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, background: "var(--pill)", border: "1px solid var(--border)" }}>
            {aliasAvatar || "🗝️"}
          </div>
          <div style={{ marginTop: 10, fontSize: 18, fontWeight: 700, color: "var(--fg)" }}>
            {aliasName}
          </div>
          {exhibitingSince && (
            <div style={{ marginTop: 2, fontSize: 11, color: "var(--muted)" }}>{exhibitingSince}</div>
          )}
          <div style={{ marginTop: 12, fontSize: 12, lineHeight: 1.5, color: "var(--muted)", maxWidth: 300 }}>
            This curator is showing this exhibition under an alias.
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={{ borderRadius: 14, background: "var(--pill)", border: "1px solid var(--border)", padding: "10px 6px", textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--fg)" }}>{itemCount}</div>
            <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", marginTop: 2 }}>
              {itemCount === 1 ? "Item in this exhibit" : "Items in this exhibit"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(overlay, document.body);
}
