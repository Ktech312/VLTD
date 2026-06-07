"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  deleteDraft,
  loadDrafts,
  type AICatalogDraft,
  type AIDraftStatus,
} from "@/lib/aiCatalogDrafts";

type Filter = "all" | "READY_FOR_REVIEW" | "NEEDS_REVIEW" | "APPROVED" | "CONVERTED";

const STATUS_LABEL: Record<AIDraftStatus, string> = {
  READY_FOR_REVIEW: "Ready",
  NEEDS_REVIEW: "Needs review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CONVERTED: "Saved to vault",
};

const STATUS_COLOR: Record<AIDraftStatus, { bg: string; color: string }> = {
  READY_FOR_REVIEW: { bg: "rgba(74,222,128,0.12)", color: "#4ade80" },
  NEEDS_REVIEW:     { bg: "rgba(245,181,72,0.12)",  color: "var(--theme-gold)" },
  APPROVED:         { bg: "rgba(74,222,128,0.2)",   color: "#4ade80" },
  REJECTED:         { bg: "rgba(248,113,113,0.12)", color: "#f87171" },
  CONVERTED:        { bg: "rgba(129,140,248,0.15)", color: "#818cf8" },
};

const CONFIDENCE_COLOR: Record<string, string> = {
  High:    "#4ade80",
  Good:    "var(--theme-gold)",
  Low:     "#f87171",
  Unknown: "var(--muted)",
};

function ConfidencePip({ score }: { score: number }) {
  const color = score >= 80 ? "#4ade80" : score >= 60 ? "var(--theme-gold)" : "#f87171";
  return (
    <div className="flex items-center gap-1.5">
      <div className="relative h-1.5 w-16 overflow-hidden rounded-full" style={{ background: "var(--pill)" }}>
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="text-[10px] font-semibold" style={{ color }}>{score}%</span>
    </div>
  );
}

function DraftCard({
  draft,
  onDelete,
}: {
  draft: AICatalogDraft;
  onDelete: () => void;
}) {
  const sc = STATUS_COLOR[draft.status];
  const canReview = draft.status === "READY_FOR_REVIEW" || draft.status === "NEEDS_REVIEW";

  return (
    <div
      className="rounded-2xl p-4 ring-1 ring-[color:var(--border)] transition"
      style={{ background: "var(--surface)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={sc}
            >
              {STATUS_LABEL[draft.status]}
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: "var(--pill)", color: CONFIDENCE_COLOR[draft.confidenceLabel] }}
            >
              {draft.confidenceLabel} confidence
            </span>
            <span className="text-[10px]" style={{ color: "var(--muted)" }}>
              via {draft.createdByLabel}
            </span>
          </div>
          <div className="mt-2 text-base font-bold" style={{ color: "var(--fg)" }}>
            {draft.title}
          </div>
          {draft.subtitle && (
            <div className="mt-0.5 text-sm" style={{ color: "var(--muted)" }}>{draft.subtitle}</div>
          )}
        </div>
        <div className="shrink-0">
          <ConfidencePip score={draft.confidenceScore} />
        </div>
      </div>

      {/* Missing fields */}
      {draft.missingFields.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {draft.missingFields.map((f) => (
            <span
              key={f}
              className="rounded-full px-2 py-0.5 text-[10px]"
              style={{ background: "rgba(248,113,113,0.1)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)" }}
            >
              ⚠ {f}
            </span>
          ))}
        </div>
      )}

      {/* Inline fields preview */}
      <div className="mt-3 flex flex-wrap gap-3 text-[11px]" style={{ color: "var(--muted)" }}>
        {draft.categoryLabel && <span>📂 {draft.categoryLabel}</span>}
        {draft.grade && <span>🏷 {draft.grade}</span>}
        {draft.certNumber && <span>🔢 {draft.certNumber}</span>}
        {draft.currentValue && (
          <span style={{ color: "var(--theme-gold)" }}>
            💰 ${draft.currentValue.toLocaleString()}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="mt-3 flex items-center gap-2">
        {canReview && (
          <Link
            href={`/ai/review?id=${draft.id}`}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold"
            style={{ background: "var(--theme-gold)", color: "#0B0B0B" }}
          >
            Review & save →
          </Link>
        )}
        {draft.status === "APPROVED" && (
          <Link
            href={`/ai/review?id=${draft.id}`}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold ring-1"
            style={{ background: "var(--pill)", color: "var(--fg)", borderColor: "var(--border)" }}
          >
            View
          </Link>
        )}
        {draft.status === "CONVERTED" && (
          <span className="text-xs" style={{ color: "#818cf8" }}>✓ In vault</span>
        )}
        <button
          type="button"
          onClick={onDelete}
          className="ml-auto text-xs"
          style={{ color: "var(--muted)" }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

export default function AIDraftsPage() {
  const [drafts, setDrafts] = useState<AICatalogDraft[]>([]);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    setDrafts(loadDrafts());
    const handler = () => setDrafts(loadDrafts());
    window.addEventListener("vltd:drafts-updated", handler);
    return () => window.removeEventListener("vltd:drafts-updated", handler);
  }, []);

  function handleDelete(id: string) {
    deleteDraft(id);
    setDrafts(loadDrafts());
  }

  const counts = {
    all: drafts.length,
    READY_FOR_REVIEW: drafts.filter(d => d.status === "READY_FOR_REVIEW").length,
    NEEDS_REVIEW: drafts.filter(d => d.status === "NEEDS_REVIEW").length,
    APPROVED: drafts.filter(d => d.status === "APPROVED").length,
    CONVERTED: drafts.filter(d => d.status === "CONVERTED").length,
  };

  const displayed = filter === "all" ? drafts : drafts.filter(d => d.status === filter);

  const TABS: { key: Filter; label: string }[] = [
    { key: "all",              label: "All" },
    { key: "READY_FOR_REVIEW", label: "Ready" },
    { key: "NEEDS_REVIEW",     label: "Needs review" },
    { key: "APPROVED",         label: "Approved" },
    { key: "CONVERTED",        label: "Saved" },
  ];

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <div className="border-b border-[color:var(--border)]" style={{ background: "var(--surface)" }}>
        <div className="mx-auto max-w-2xl px-4 py-6">
          <div className="flex items-center gap-3">
            <Link href="/vault" className="text-sm" style={{ color: "var(--muted)" }}>Vault</Link>
            <span style={{ color: "var(--muted)" }}>/</span>
            <span className="text-sm font-semibold" style={{ color: "var(--fg)" }}>AI Drafts</span>
          </div>
          <h1 className="mt-3 text-2xl font-bold" style={{ color: "var(--fg)" }}>AI Draft Queue</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            AI-detected items waiting for your review before being saved to the vault.
          </p>

          {/* Stats */}
          {drafts.length > 0 && (
            <div className="mt-4 flex items-center gap-5">
              <div>
                <span className="text-lg font-bold" style={{ color: "var(--theme-gold)" }}>{counts.READY_FOR_REVIEW}</span>
                <span className="ml-1.5 text-xs" style={{ color: "var(--muted)" }}>ready</span>
              </div>
              <div>
                <span className="text-lg font-bold" style={{ color: "var(--fg)" }}>{counts.NEEDS_REVIEW}</span>
                <span className="ml-1.5 text-xs" style={{ color: "var(--muted)" }}>needs review</span>
              </div>
              <div>
                <span className="text-lg font-bold" style={{ color: "#818cf8" }}>{counts.CONVERTED}</span>
                <span className="ml-1.5 text-xs" style={{ color: "var(--muted)" }}>saved</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-6">
        {/* Filter tabs */}
        <div className="flex flex-wrap gap-1 rounded-xl p-1 w-fit" style={{ background: "var(--pill)" }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold transition"
              style={
                filter === t.key
                  ? { background: "var(--theme-gold)", color: "#0B0B0B" }
                  : { color: "var(--muted)" }
              }
            >
              {t.label}
              {counts[t.key] > 0 && (
                <span className="ml-1.5 opacity-70">{counts[t.key]}</span>
              )}
            </button>
          ))}
        </div>

        {/* List */}
        {displayed.length === 0 ? (
          <div
            className="mt-6 rounded-2xl px-6 py-14 text-center ring-1 ring-[color:var(--border)]"
            style={{ background: "var(--surface)" }}
          >
            <div className="text-4xl">🤖</div>
            <div className="mt-4 text-base font-semibold" style={{ color: "var(--fg)" }}>
              {filter === "all" ? "No drafts yet" : `No ${TABS.find(t => t.key === filter)?.label.toLowerCase()} drafts`}
            </div>
            <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
              Drafts appear here when AI detects items from camera scans, barcodes, or photo uploads.
            </p>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {displayed.map((draft) => (
              <DraftCard
                key={draft.id}
                draft={draft}
                onDelete={() => handleDelete(draft.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
