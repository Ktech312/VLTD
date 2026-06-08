"use client";

import type { GoalProgress } from "@/lib/collectionGoals";
import { UNIVERSE_LABEL, type UniverseKey } from "@/lib/taxonomy";

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

  return (
    <div
      className="overflow-hidden rounded-2xl ring-1"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="px-4 pb-3 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {universeLabel ? (
                <span
                  className="text-[10px] font-semibold uppercase tracking-[0.14em]"
                  style={{ color: "var(--muted2)" }}
                >
                  {universeLabel}
                </span>
              ) : null}
              {goal.isAlmostThere ? (
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
              ) : null}
              {goal.isComplete ? (
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold ring-1"
                  style={{
                    background: "var(--theme-gold-subtle)",
                    borderColor: "var(--theme-gold-border)",
                    color: "var(--theme-gold)",
                  }}
                >
                  Complete
                </span>
              ) : null}
            </div>
            <div className="mt-0.5 truncate text-[16px] font-bold" style={{ color: "var(--fg)" }}>
              {goal.name}
            </div>
            {goal.subject ? (
              <div className="mt-0.5 text-[12px]" style={{ color: "var(--muted)" }}>
                Subject: {goal.subject}
              </div>
            ) : null}
          </div>

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

        <div className="mt-3">
          {/* Progress bar with milestone ticks */}
          <div className="relative">
            <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--pill)" }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${goal.pct}%`,
                  background: goal.isComplete
                    ? "var(--theme-gold)"
                    : goal.isAlmostThere
                      ? "var(--success, #4ade80)"
                      : "var(--theme-gold)",
                  opacity: goal.isComplete ? 1 : 0.75,
                }}
              />
            </div>
            {/* Milestone ticks at 25 / 50 / 75 % */}
            {[25, 50, 75].map((m) => (
              <div
                key={m}
                className="absolute top-0 h-2 w-px"
                style={{
                  left: `${m}%`,
                  background: m <= goal.pct ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.2)",
                }}
              />
            ))}
          </div>

          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-[12px]" style={{ color: "var(--muted)" }}>
              {goal.ownedCount} / {goal.targetCount} items
            </span>
            {goal.missing > 0 && !goal.isComplete ? (() => {
              const nextMilestone = [25, 50, 75, 100].find(m => (m / 100) * goal.targetCount > goal.ownedCount);
              const itemsToNext = nextMilestone
                ? Math.ceil((nextMilestone / 100) * goal.targetCount) - goal.ownedCount
                : null;
              return (
                <span className="text-[11px]" style={{ color: "var(--muted)" }}>
                  {itemsToNext !== null && nextMilestone !== 100
                    ? `${itemsToNext} to ${nextMilestone}%`
                    : `${goal.missing} to go`}
                </span>
              );
            })() : null}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 px-4 py-3" style={{ borderTop: "1px solid var(--border)" }}>
        {goal.missing > 0 ? (
          <button
            type="button"
            onClick={onAddToWishlist}
            className="flex-1 rounded-full py-2 text-[12px] font-semibold ring-1 transition"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              color: "var(--fg)",
            }}
          >
            Add {goal.missing} to Want List
          </button>
        ) : null}
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
