"use client";

import { useEffect, useState } from "react";

import { loadItems } from "@/lib/vaultModel";
import type { VaultItem } from "@/lib/vaultModel";
import { getVaultImagePublicUrl } from "@/lib/vaultCloud";

function getPrimaryImageUrl(item: VaultItem): string {
  if (item.images && item.images.length > 0) {
    const primary = item.images.find((img) => img.role === "primary") ?? item.images[0];
    if (primary.url) return primary.url;
    if (primary.storageKey) return getVaultImagePublicUrl(primary.storageKey);
  }
  if (item.imageFrontUrl) return item.imageFrontUrl;
  if (item.imageFrontStoragePath) return getVaultImagePublicUrl(item.imageFrontStoragePath);
  return "";
}

function fmt(value?: number) {
  if (value == null) return "—";
  return "$" + value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function itemValue(item: VaultItem) {
  return item.currentValue ?? item.estimatedValue ?? item.valueMedian ?? item.purchasePrice ?? 0;
}

export default function VaultPrintPage() {
  const [items, setItems] = useState<VaultItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const all = loadItems({ includeAllProfiles: true }).filter(
      (i) => i.status !== "WISHLIST" && i.status !== "SOLD"
    );
    // Sort by universe then title
    all.sort((a, b) => {
      const ua = (a.universe ?? "Other").toLowerCase();
      const ub = (b.universe ?? "Other").toLowerCase();
      if (ua !== ub) return ua.localeCompare(ub);
      return (a.title ?? "").localeCompare(b.title ?? "");
    });
    setItems(all);
    setReady(true);
  }, []);

  const totalValue = items.reduce((sum, i) => sum + itemValue(i), 0);
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  // Group by universe
  const groups: Record<string, VaultItem[]> = {};
  for (const item of items) {
    const key = item.universe ?? "Other";
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  const sortedGroups = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));

  return (
    <>
      <style>{`
        @media print {
          body { margin: 0; padding: 0; background: white !important; }
          .no-print { display: none !important; }
          .print-page-break { page-break-before: always; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f9f9f7; }
        .page-wrap { max-width: 900px; margin: 0 auto; padding: 40px 32px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1a1a1a; padding-bottom: 20px; margin-bottom: 32px; }
        .logo { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; color: #1a1a1a; }
        .logo span { color: #c9a84c; }
        .report-meta { text-align: right; font-size: 12px; color: #666; }
        .report-meta strong { display: block; font-size: 14px; color: #1a1a1a; margin-bottom: 2px; }
        .summary-bar { display: flex; gap: 32px; margin-bottom: 40px; }
        .summary-card { background: white; border: 1px solid #e5e5e5; border-radius: 12px; padding: 16px 24px; }
        .summary-label { font-size: 10px; font-weight: 700; letter-spacing: 0.12em; color: #999; text-transform: uppercase; margin-bottom: 4px; }
        .summary-value { font-size: 22px; font-weight: 800; color: #1a1a1a; }
        .group-header { font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #999; border-bottom: 1px solid #e5e5e5; padding-bottom: 6px; margin: 28px 0 14px; }
        .item-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 14px; }
        .item-card { background: white; border: 1px solid #e8e8e8; border-radius: 10px; overflow: hidden; break-inside: avoid; }
        .item-thumb { width: 100%; aspect-ratio: 1; object-fit: cover; background: #f0ede8; }
        .item-thumb-placeholder { width: 100%; aspect-ratio: 1; background: #f0ede8; display: flex; align-items: center; justify-content: center; font-size: 28px; color: #ccc; }
        .item-body { padding: 10px; }
        .item-title { font-size: 11px; font-weight: 700; color: #1a1a1a; line-height: 1.3; margin-bottom: 2px; }
        .item-subtitle { font-size: 10px; color: #888; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .item-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 4px; }
        .item-grade { font-size: 10px; font-weight: 700; background: #f0ede8; color: #7a6a55; border-radius: 4px; padding: 2px 5px; }
        .item-value { font-size: 11px; font-weight: 700; color: #1a1a1a; }
        .footer { margin-top: 48px; border-top: 1px solid #e5e5e5; padding-top: 16px; display: flex; justify-content: space-between; font-size: 11px; color: #aaa; }
        .print-btn { position: fixed; bottom: 32px; right: 32px; background: #c9a84c; color: #000; border: none; border-radius: 999px; padding: 14px 28px; font-size: 15px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 20px rgba(0,0,0,0.18); z-index: 100; }
        .print-btn:hover { background: #b8963e; }
        .loading { text-align: center; padding: 80px 0; color: #aaa; font-size: 14px; }
      `}</style>

      {/* Print button — hidden when printing */}
      <button className="print-btn no-print" onClick={() => window.print()}>
        Save as PDF ↓
      </button>

      <div className="page-wrap">
        {/* Header */}
        <div className="header">
          <div className="logo">
            VL<span>T</span>D
          </div>
          <div className="report-meta">
            <strong>Collection Report</strong>
            {today}
          </div>
        </div>

        {!ready ? (
          <div className="loading">Loading collection…</div>
        ) : (
          <>
            {/* Summary bar */}
            <div className="summary-bar">
              <div className="summary-card">
                <div className="summary-label">Total Items</div>
                <div className="summary-value">{items.length}</div>
              </div>
              <div className="summary-card">
                <div className="summary-label">Est. Collection Value</div>
                <div className="summary-value">{fmt(totalValue)}</div>
              </div>
              <div className="summary-card">
                <div className="summary-label">Categories</div>
                <div className="summary-value">{sortedGroups.length}</div>
              </div>
            </div>

            {/* Items by universe */}
            {sortedGroups.map(([universe, groupItems]) => {
              const groupTotal = groupItems.reduce((s, i) => s + itemValue(i), 0);
              return (
                <div key={universe}>
                  <div className="group-header">
                    {universe} &nbsp;·&nbsp; {groupItems.length} item{groupItems.length !== 1 ? "s" : ""} &nbsp;·&nbsp; {fmt(groupTotal)}
                  </div>
                  <div className="item-grid">
                    {groupItems.map((item) => {
                      const imgUrl = getPrimaryImageUrl(item);
                      const val = itemValue(item);
                      return (
                        <div className="item-card" key={item.id}>
                          {imgUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={imgUrl}
                              alt={item.title}
                              className="item-thumb"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                              }}
                            />
                          ) : (
                            <div className="item-thumb-placeholder">◈</div>
                          )}
                          <div className="item-body">
                            <div className="item-title">{item.title}</div>
                            {item.subtitle && <div className="item-subtitle">{item.subtitle}</div>}
                            <div className="item-footer">
                              {item.grade ? (
                                <span className="item-grade">{item.grade}</span>
                              ) : (
                                <span />
                              )}
                              {val > 0 && <span className="item-value">{fmt(val)}</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Footer */}
            <div className="footer">
              <span>Generated by VLTD Vault</span>
              <span>Values are estimates only · Not a certified appraisal</span>
            </div>
          </>
        )}
      </div>
    </>
  );
}
