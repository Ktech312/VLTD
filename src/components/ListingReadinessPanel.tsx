"use client";

import Link from "next/link";
import { getPrimaryImageUrl, type VaultItem } from "@/lib/vaultModel";

// ─── types ────────────────────────────────────────────────────────────────────

export type ReadinessCheck = {
  key: string;
  label: string;
  detail: string;
  required: boolean;
  passed: boolean;
  actionLabel?: string;
  actionHref?: string;
};

export type ReadinessResult = {
  checks: ReadinessCheck[];
  score: number;        // 0–100
  level: "ready" | "almost" | "incomplete";
  requiredPassed: number;
  requiredTotal: number;
};

// ─── scoring logic ────────────────────────────────────────────────────────────

export function computeReadiness(item: VaultItem): ReadinessResult {
  const imageUrl = getPrimaryImageUrl(item) || "";
  const hasImage = imageUrl.length > 0;
  const hasImages = (item.images?.length ?? 0) > 0 || hasImage;

  const checks: ReadinessCheck[] = [
    {
      key: "title",
      label: "Title",
      detail: item.title && item.title.trim().length > 2
        ? `"${item.title.trim().slice(0, 60)}"`
        : "No title — buyers can't find this item.",
      required: true,
      passed: !!(item.title && item.title.trim().length > 2),
      actionLabel: "Edit item",
      actionHref: `/vault/item/${item.id}`,
    },
    {
      key: "price",
      label: "Asking price",
      detail: item.askingPrice && item.askingPrice > 0
        ? `$${item.askingPrice.toLocaleString()}`
        : "No price set — listing won't appear in the marketplace.",
      required: true,
      passed: !!(item.askingPrice && item.askingPrice > 0),
      actionLabel: "Set price",
      actionHref: `/vault/item/${item.id}`,
    },
    {
      key: "photo",
      label: "Photo",
      detail: hasImages
        ? `${(item.images?.length ?? 0) + (hasImage && !(item.images?.length) ? 1 : 0)} photo${((item.images?.length ?? 0) > 1) ? "s" : ""}`
        : "No photos — items with images sell faster.",
      required: true,
      passed: hasImages,
      actionLabel: "Add photo",
      actionHref: `/vault/item/${item.id}`,
    },
    {
      key: "grade",
      label: "Grade or condition",
      detail: item.grade
        ? item.grade
        : item.condition
        ? item.condition
        : "Helps buyers assess quality before inquiring.",
      required: false,
      passed: !!(item.grade || item.condition),
      actionLabel: "Add grade",
      actionHref: `/vault/item/${item.id}`,
    },
    {
      key: "description",
      label: "Description",
      detail: item.notes && item.notes.trim().length >= 10
        ? `${item.notes.trim().slice(0, 60)}${item.notes.length > 60 ? "…" : ""}`
        : "A short description builds buyer confidence.",
      required: false,
      passed: !!(item.notes && item.notes.trim().length >= 10),
      actionLabel: "Add description",
      actionHref: `/vault/item/${item.id}`,
    },
    {
      key: "subject",
      label: "Subject tag",
      detail: item.subject
        ? item.subject
        : "Tag a subject to appear in registry searches.",
      required: false,
      passed: !!(item.subject && item.subject.trim().length > 0),
      actionLabel: "Add subject",
      actionHref: `/vault/item/${item.id}`,
    },
  ];

  const requiredChecks = checks.filter((c) => c.required);
  const requiredPassed = requiredChecks.filter((c) => c.passed).length;
  const requiredTotal = requiredChecks.length;
  const totalPassed = checks.filter((c) => c.passed).length;
  const score = Math.round((totalPassed / checks.length) * 100);

  const level: ReadinessResult["level"] =
    requiredPassed < requiredTotal
      ? "incomplete"
      : score >= 80
      ? "ready"
      : "almost";

  return { checks, score, level, requiredPassed, requiredTotal };
}

// ─── ScoreRing ────────────────────────────────────────────────────────────────

function ScoreRing({ score, level }: { score: number; level: ReadinessResult["level"] }) {
  const size = 64;
  const r = 26;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color =
    level === "ready" ? "#4ade80" : level === "almost" ? "var(--theme-gold)" : "#f87171";

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--pill)" strokeWidth={5} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={color}
          strokeWidth={5}
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-black" style={{ color }}>
          {score}
        </span>
      </div>
    </div>
  );
}

// ─── CheckRow ─────────────────────────────────────────────────────────────────

function CheckRow({ check }: { check: ReadinessCheck }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="mt-0.5 shrink-0 text-base leading-none">
        {check.passed
          ? <span style={{ color: "#4ade80" }}>✓</span>
          : check.required
          ? <span style={{ color: "#f87171" }}>✕</span>
          : <span style={{ color: "var(--muted)" }}>○</span>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold" style={{ color: "var(--fg)" }}>
            {check.label}
          </span>
          {check.required && !check.passed && (
            <span
              className="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
              style={{ background: "rgba(248,113,113,0.15)", color: "#f87171" }}
            >
              Required
            </span>
          )}
        </div>
        <div className="mt-0.5 text-[11px]" style={{ color: check.passed ? "var(--muted)" : "var(--muted)" }}>
          {check.detail}
        </div>
      </div>
      {!check.passed && check.actionLabel && check.actionHref && (
        <Link
          href={check.actionHref}
          className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 transition hover:brightness-110"
          style={{ background: "var(--pill)", color: "var(--theme-gold)", borderColor: "var(--border)" }}
        >
          {check.actionLabel}
        </Link>
      )}
    </div>
  );
}

// ─── ListingReadinessPanel ────────────────────────────────────────────────────

export default function ListingReadinessPanel({ item }: { item: VaultItem }) {
  const result = computeReadiness(item);

  const levelLabel =
    result.level === "ready"
      ? "Ready to list"
      : result.level === "almost"
      ? "Almost ready"
      : "Needs work";

  const levelColor =
    result.level === "ready" ? "#4ade80" : result.level === "almost" ? "var(--theme-gold)" : "#f87171";

  const bgColor =
    result.level === "ready"
      ? "rgba(74,222,128,0.06)"
      : result.level === "almost"
      ? "rgba(245,181,72,0.06)"
      : "rgba(248,113,113,0.06)";

  const borderColor =
    result.level === "ready"
      ? "rgba(74,222,128,0.22)"
      : result.level === "almost"
      ? "rgba(245,181,72,0.22)"
      : "rgba(248,113,113,0.22)";

  return (
    <div
      className="rounded-2xl ring-1"
      style={{ background: bgColor, borderColor }}
    >
      {/* Header row */}
      <div className="flex items-center gap-4 px-4 pt-4 pb-3 border-b" style={{ borderColor }}>
        <ScoreRing score={result.score} level={result.level} />
        <div className="flex-1 min-w-0">
          <div className="text-[11px] uppercase tracking-[0.12em] font-semibold mb-0.5" style={{ color: "var(--muted)" }}>
            Listing readiness
          </div>
          <div className="text-base font-bold" style={{ color: levelColor }}>{levelLabel}</div>
          <div className="text-[11px] mt-0.5" style={{ color: "var(--muted)" }}>
            {result.requiredPassed}/{result.requiredTotal} required ·{" "}
            {result.checks.filter((c) => c.passed).length}/{result.checks.length} total
          </div>
        </div>
      </div>

      {/* Checklist */}
      <div className="divide-y px-4" style={{ borderColor: "var(--border)" }}>
        {result.checks.map((check) => (
          <CheckRow key={check.key} check={check} />
        ))}
      </div>

      {/* CTA if ready */}
      {result.level === "ready" && (
        <div className="px-4 pb-4 pt-2">
          <div className="text-[11px]" style={{ color: "var(--muted)" }}>
            This listing is market-ready. Share a direct link or post to social to attract buyers.
          </div>
        </div>
      )}
    </div>
  );
}
