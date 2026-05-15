"use client";

import { useEffect, useMemo, useState } from "react";
import AddGoalSheet from "@/components/AddGoalSheet";
import GoalCard from "@/components/GoalCard";
import {
  addGoal,
  computeAllGoalProgress,
  deleteGoal,
  loadGoals,
  type GoalProgress,
} from "@/lib/collectionGoals";
import { loadItems } from "@/lib/vaultModel";
import { addWishlistItem } from "@/lib/wishlistModel";

export default function GoalsPage() {
  const [goals, setGoals] = useState(loadGoals);
  const [items, setItems] = useState(() => loadItems());
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    const onFocus = () => {
      setGoals(loadGoals());
      setItems(loadItems());
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const progress = useMemo(() => computeAllGoalProgress(goals, items), [goals, items]);

  function handleAddToWishlist(goal: GoalProgress) {
    if (goal.missing <= 0) return;
    addWishlistItem({
      title: `${goal.name} - ${goal.missing} missing pieces`,
      notes: `${goal.ownedCount} of ${goal.targetCount} owned (${goal.pct}% complete)`,
      universe: goal.universe,
      subject: goal.subject,
      priority: goal.isAlmostThere ? "high" : "medium",
    });
  }

  function handleDelete(id: string) {
    deleteGoal(id);
    setGoals(loadGoals());
  }

  return (
    <main className="mx-auto min-h-screen max-w-xl px-4 pb-20 pt-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-[22px] font-bold" style={{ color: "var(--fg)" }}>
          Collection Goals
        </h1>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="rounded-full px-4 py-2 text-[13px] font-semibold ring-1 transition"
          style={{
            background: "var(--theme-gold-subtle)",
            borderColor: "var(--theme-gold-border)",
            color: "var(--theme-gold)",
          }}
        >
          + Add Goal
        </button>
      </div>

      {progress.length === 0 ? (
        <div
          className="rounded-2xl p-8 text-center ring-1"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="mb-2 text-[15px] font-semibold" style={{ color: "var(--fg)" }}>
            No goals yet
          </div>
          <div className="mb-4 text-[13px]" style={{ color: "var(--muted)" }}>
            Create a goal to track how close you are to completing a set or building a collection.
          </div>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="rounded-full px-5 py-2 text-[13px] font-semibold ring-1"
            style={{
              background: "var(--theme-gold-subtle)",
              borderColor: "var(--theme-gold-border)",
              color: "var(--theme-gold)",
            }}
          >
            + Add your first goal
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {progress.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onAddToWishlist={() => handleAddToWishlist(goal)}
              onDelete={() => handleDelete(goal.id)}
            />
          ))}
        </div>
      )}

      {showAdd ? (
        <AddGoalSheet
          onClose={() => setShowAdd(false)}
          onSave={(fields) => {
            addGoal(fields);
            setGoals(loadGoals());
            setShowAdd(false);
          }}
        />
      ) : null}
    </main>
  );
}
