"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getGallerySections, type Gallery } from "@/lib/galleryModel";
import { type VaultItem } from "@/lib/vaultModel";

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

export default function ExhibitionInfoModal({
  gallery,
  items,
  onClose,
}: {
  gallery: Gallery;
  items: VaultItem[];
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

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

  const itemsById = new Map(items.map((item) => [item.id, item]));
  const sections = getGallerySections(gallery);
  const breakdown = sections.map((section, idx) => {
    const sectionItems = section.itemIds
      .map((id) => itemsById.get(id))
      .filter(Boolean) as VaultItem[];
    const value = sectionItems.reduce((sum, item) => sum + Number(item.currentValue ?? 0), 0);
    return {
      id: section.id,
      title: section.title || `Exhibit ${idx + 1}`,
      itemCount: sectionItems.length,
      value,
    };
  });

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
          maxWidth: 480,
          maxHeight: "85vh",
          overflowY: "auto",
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

        <div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted)", paddingRight: 30 }}>
          EXHIBITION INFO
        </div>
        <div style={{ marginTop: 4, fontSize: 18, fontWeight: 700, color: "var(--fg)", paddingRight: 30 }}>
          {gallery.title || "Exhibition"}
        </div>

        {gallery.description && (
          <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.6, color: "var(--muted)" }}>
            {gallery.description}
          </div>
        )}

        {breakdown.length > 0 ? (
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>
              Exhibits in this Exhibition
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {breakdown.map((section) => (
                <div
                  key={section.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    borderRadius: 12,
                    background: "var(--pill)",
                    border: "1px solid var(--border)",
                    padding: "10px 12px",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {section.title}
                  </div>
                  <div style={{ flexShrink: 0, display: "flex", gap: 10, fontSize: 11, color: "var(--muted)" }}>
                    <span>{section.itemCount} {section.itemCount === 1 ? "item" : "items"}</span>
                    <span>{formatMoney(section.value)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 18, fontSize: 12, color: "var(--muted)" }}>
            This Exhibition isn&apos;t broken into Exhibits yet - all items are shown together.
          </div>
        )}
      </div>
    </div>
  );

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(overlay, document.body);
}
