"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { computeAllGoalProgress, type CollectionGoal } from "@/lib/collectionGoals";
import type { VaultItem } from "@/lib/vaultModel";

export default function GoalsProgressWidget({
  goals,
  items,
}: {
  goals: CollectionGoal[];
  items: VaultItem[];
}) {
  const router = useRouter();
  const progress = useMemo(() => computeAllGoalProgress(goals, items).slice(0, 3), [goals, items]);

  if (progress.length === 0) return null;

  return (
    <div
      className="overflow-hidden rounded-2xl ring-1"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <span className="text-[13px] font-bold" style={{ color: "var(--fg)" }}>
          Collection Goals
        </span>
        <button
          type="button"
          onClick={() => router.push("/goals")}
          className="text-[12px] transition-opacity hover:opacity-70"
          style={{ color: "var(--theme-gold)" }}
        >
          See all &gt;
        </button>
      </div>

      <div className="divide-y" style={{ borderColor: "var(--border)" }}>
        {progress.map((goal) => (
          <div key={goal.id} className="px-4 py-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="truncate text-[13px] font-semibold" style={{ color: "var(--fg)" }}>
                {goal.name}
              </span>
              <span
                className="ml-2 shrink-0 text-[12px] font-bold"
                style={{ color: goal.isComplete ? "var(--theme-gold)" : "var(--muted)" }}
              >
                {goal.pct}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--pill)" }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${goal.pct}%`,
                  background: goal.isComplete
                    ? "var(--theme-gold)"
                    : goal.isAlmostThere
                      ? "var(--success, #4ade80)"
                      : "var(--theme-gold)",
                  opacity: goal.isComplete ? 1 : 0.75,
                  transition: "width 0.6s ease",
                }}
              />
            </div>
            <div className="mt-1 text-[11px]" style={{ color: "var(--muted2)" }}>
              {goal.ownedCount} / {goal.targetCount}
              {goal.isAlmostThere && !goal.isComplete ? (
                <span style={{ color: "var(--success, #4ade80)" }}> - Almost there</span>
              ) : null}
              {goal.isComplete ? (
                <span style={{ color: "var(--theme-gold)" }}> - Complete</span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
