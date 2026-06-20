"use client";

import Link from "next/link";
import type { GoalProgress } from "@/lib/collectionGoals";
import { UNIVERSE_LABEL, type UniverseKey } from "@/lib/taxonomy";

function NextMilestoneHint({ goal }: { goal: GoalProgress }) {
  if (goal.isComplete || goal.missing <= 0) return null;
  const milestones = [25, 50, 75, 100];
  const next = milestones.find((m) => (m / 100) * goal.targetCount > goal.ownedCount);
  const itemsToNext = next ? Math.ceil((next / 100) * goal.targetCount) - goal.ownedCount : null;
  const label =
    itemsToNext !== null && next !== 100
      ? `${itemsToNext} more to ${next}%`
      : `${goal.missing} to go`;
  return (
    <span className="text-[11px]" style={{ color: "var(--muted)" }}>
      {label}
    </span>
  );
}

export default function GoalCard({
  goal,
  onAddToWishlist,
  onDelete,
}: {
  goal: GoalProgress;
  onAddToWishlist: () => void;
  onDelete: () => void;
}) {
  const universeLabel = goal.universe
    ? UNIVERSE_LABEL[goal.universe as UniverseKey] ?? goal.universe
    : null;

  const vaultBrowseHref = (() => {
    const params = new URLSearchParams();
    if (goal.universe) params.set("universe", goal.universe);
    if (goal.subject) params.set("q", goal.subject);
    const qs = params.toString();
    return qs ? `/vault?${qs}` : "/vault";
  })();

  return (
    <div
      className="overflow-hidden rounded-2xl ring-1"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      {/* Body */}
      <div className="px-4 pb-3 pt-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {universeLabel && (
                <span
                  className="text-[10px] font-semibold uppercase tracking-[0.14em]"
                  style={{ color: "var(--muted2)" }}
                >
                  {universeLabel}
                </span>
              )}
              {goal.isAlmostThere && !goal.isComplete && (
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold ring-1"
                  style={{
                    background: "var(--success-subtle, rgba(74,222,128,0.12))",
                    borderColor: "var(--success-border, rgba(74,222,128,0.35))",
                    color: "var(--success, #4ade80)",
                  }}
                >
                  Almost there
                </span>
              )}
              {goal.isComplete && (
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold ring-1"
                  style={{
                    background: "var(--theme-gold-subtle)",
                    borderColor: "var(--theme-gold-border)",
                    color: "var(--theme-gold)",
                  }}
                >
                  🏆 Complete
                </span>
              )}
            </div>
            <div
              className="mt-0.5 truncate text-[16px] font-bold"
              style={{ color: "var(--fg)" }}
            >
              {goal.name}
            </div>
            {goal.subject && (
              <div className="mt-0.5 text-[12px]" style={{ color: "var(--muted)" }}>
                Subject: {goal.subject}
              </div>
            )}
          </div>

          {/* % badge */}
          <div
            className="shrink-0 rounded-xl px-3 py-1.5 text-center ring-1"
            style={{
              background: goal.isComplete ? "var(--theme-gold-subtle)" : "var(--pill)",
              borderColor: goal.isComplete ? "var(--theme-gold-border)" : "var(--border)",
            }}
          >
            <div
              className="text-[20px] font-black leading-none"
              style={{ color: goal.isComplete ? "var(--theme-gold)" : "var(--fg)" }}
            >
              {goal.pct}%
            </div>
            <div className="mt-0.5 text-[10px]" style={{ color: "var(--muted2)" }}>
              complete
            </div>
          </div>
        </div>

        {/* Notes */}
        {goal.notes && (
          <div
            className="mt-2 rounded-xl px-3 py-2 text-[11px] italic leading-relaxed"
            style={{ background: "var(--pill)", color: "var(--muted)" }}
          >
            {goal.notes}
          </div>
        )}

        {/* Progress bar */}
        <div className="mt-3">
          <div className="relative">
            <div
              className="h-2 overflow-hidden rounded-full"
              style={{ background: "var(--pill)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(100, goal.pct)}%`,
                  background: goal.isComplete
                    ? "var(--theme-gold)"
                    : goal.isAlmostThere
                    ? "var(--success, #4ade80)"
                    : "var(--theme-gold)",
                  opacity: goal.isComplete ? 1 : 0.85,
                }}
              />
            </div>
            {/* Milestone ticks at 25 / 50 / 75 */}
            {[25, 50, 75].map((m) => (
              <div
                key={m}
                className="absolute top-0 h-2 w-px"
                style={{
                  left: `${m}%`,
                  background:
                    m <= goal.pct ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.18)",
                }}
              />
            ))}
          </div>

          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-[12px]" style={{ color: "var(--muted)" }}>
              {goal.ownedCount} / {goal.targetCount} items
            </span>
            <NextMilestoneHint goal={goal} />
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div
        className="flex flex-wrap items-center gap-2 px-4 py-3"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        {goal.missing > 0 && !goal.isComplete && (
          <button
            type="button"
            onClick={onAddToWishlist}
            className="flex-1 rounded-full py-2 text-[12px] font-semibold ring-1 transition hover:brightness-110"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              color: "var(--fg)",
            }}
          >
            Add {goal.missing} to Want List
          </button>
        )}
        <Link
          href={vaultBrowseHref}
          className="rounded-full px-3 py-2 text-[12px] font-semibold ring-1 transition hover:brightness-110"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
            color: "var(--muted)",
          }}
        >
          Browse vault
        </Link>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-full px-3 py-2 text-[12px] ring-1 transition"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
            color: "var(--muted2)",
          }}
        >
          Remove
        </button>
      </div>
    </div>
  );
}
