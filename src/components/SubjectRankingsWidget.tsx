"use client";

import { useMemo } from "react";
import { computeSubjectRankings, subjectCoverage } from "@/lib/subjectRankings";
import type { VaultItem } from "@/lib/vaultModel";

function money(n: number) {
  if (!n) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function SubjectRankingsWidget({
  items,
  onFilter,
  maxRows = 8,
}: {
  items: VaultItem[];
  onFilter?: (subject: string) => void;
  maxRows?: number;
}) {
  const rankings = useMemo(() => computeSubjectRankings(items), [items]);
  const coverage = useMemo(() => subjectCoverage(items), [items]);

  if (rankings.length === 0) {
    return (
      <div
        className="rounded-2xl p-5 text-center ring-1"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="mb-1 text-[13px] font-semibold" style={{ color: "var(--fg)" }}>
          No subjects tagged yet
        </div>
        <div className="text-[12px]" style={{ color: "var(--muted)" }}>
          Add a Subject when cataloguing items to see your collection ranked.
        </div>
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-2xl ring-1"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold" style={{ color: "var(--fg)" }}>
            Your Top Collections
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1"
            style={{
              background: "var(--theme-gold-subtle)",
              borderColor: "var(--theme-gold-border)",
              color: "var(--theme-gold)",
            }}
          >
            Vault Registry
          </span>
        </div>
        {coverage.total > 0 ? (
          <span className="text-[11px]" style={{ color: "var(--muted2)" }}>
            {coverage.tagged}/{coverage.total} tagged
          </span>
        ) : null}
      </div>

      <div className="divide-y" style={{ borderColor: "var(--border)" }}>
        {rankings.slice(0, maxRows).map((rank, index) => (
          <button
            key={rank.subject.toLowerCase()}
            type="button"
            onClick={() => onFilter?.(rank.subject)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-opacity hover:opacity-75 active:opacity-60"
          >
            <div
              className="w-6 shrink-0 text-center text-[12px] font-black"
              style={{ color: index === 0 ? "var(--theme-gold)" : "var(--muted2)" }}
            >
              {index + 1}
            </div>

            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold" style={{ color: "var(--fg)" }}>
                {rank.subject}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {rank.totalValue > 0 ? (
                <span className="text-[11px]" style={{ color: "var(--muted)" }}>
                  {money(rank.totalValue)}
                </span>
              ) : null}
              <span
                className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1"
                style={{
                  background: index === 0 ? "var(--theme-gold-subtle)" : "var(--pill)",
                  borderColor: index === 0 ? "var(--theme-gold-border)" : "var(--border)",
                  color: index === 0 ? "var(--theme-gold)" : "var(--muted)",
                }}
              >
                {rank.count} {rank.count === 1 ? "item" : "items"}
              </span>
            </div>

            <div className="shrink-0 text-[11px]" style={{ color: "var(--muted2)" }}>
              &gt;
            </div>
          </button>
        ))}
      </div>

      {coverage.total > 0 && coverage.tagged < coverage.total ? (
        <div
          className="px-4 py-2.5 text-center text-[11px]"
          style={{ borderTop: "1px solid var(--border)", color: "var(--muted2)" }}
        >
          {coverage.total - coverage.tagged} items without a subject tag
        </div>
      ) : null}
    </div>
  );
}
