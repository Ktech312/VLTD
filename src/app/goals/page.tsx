"use client";

import Link from "next/link";
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

type Sort = "progress" | "alpha" | "recent";

// ─── MiniRing ─────────────────────────────────────────────────────────────────

function MiniRing({ pct, size = 44 }: { pct: number; size?: number }) {
  const r = size / 2 - 5;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const color = pct >= 100 ? "var(--theme-gold)" : pct >= 80 ? "#4ade80" : pct >= 50 ? "var(--theme-gold)" : "#f87171";
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--pill)" strokeWidth={4} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={4}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.7s ease" }}
      />
    </svg>
  );
}

// ─── OverviewCard ─────────────────────────────────────────────────────────────

function OverviewCard({ goals }: { goals: GoalProgress[] }) {
  const total = goals.length;
  if (total === 0) return null;
  const complete = goals.filter(g => g.isComplete).length;
  const almostThere = goals.filter(g => g.isAlmostThere && !g.isComplete).length;
  const avgPct = Math.round(goals.reduce((s, g) => s + g.pct, 0) / total);

  return (
    <div className="rounded-2xl p-4 ring-1 ring-[color:var(--border)]" style={{ background: "var(--surface)" }}>
      <div className="flex items-center justify-between gap-4">
        {/* Ring */}
        <div className="relative shrink-0">
          <MiniRing pct={avgPct} size={72} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-bold" style={{ color: "var(--fg)" }}>{avgPct}%</span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-1 flex-wrap gap-4">
          <div>
            <div className="text-2xl font-black" style={{ color: "var(--fg)" }}>{total}</div>
            <div className="text-[11px]" style={{ color: "var(--muted)" }}>goals</div>
          </div>
          <div>
            <div className="text-2xl font-black" style={{ color: "var(--theme-gold)" }}>{complete}</div>
            <div className="text-[11px]" style={{ color: "var(--muted)" }}>complete</div>
          </div>
          <div>
            <div className="text-2xl font-black" style={{ color: "#4ade80" }}>{almostThere}</div>
            <div className="text-[11px]" style={{ color: "var(--muted)" }}>almost there</div>
          </div>
          <div>
            <div className="text-2xl font-black" style={{ color: "var(--fg)" }}>{total - complete - almostThere}</div>
            <div className="text-[11px]" style={{ color: "var(--muted)" }}>in progress</div>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3">
        <div className="flex justify-between text-[10px] mb-1" style={{ color: "var(--muted)" }}>
          <span>Average completion</span>
          <span>{avgPct}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--pill)" }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${avgPct}%`,
              background: avgPct >= 80 ? "#4ade80" : "var(--theme-gold)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── CelebrationBanner ────────────────────────────────────────────────────────

function CelebrationBanner({ goal }: { goal: GoalProgress }) {
  return (
    <div
      className="rounded-2xl px-5 py-4 ring-1"
      style={{ background: "var(--theme-gold-subtle, rgba(245,181,72,0.1))", borderColor: "var(--theme-gold-border, rgba(245,181,72,0.35))" }}
    >
      <div className="flex items-center gap-3">
        <div className="text-3xl">🏆</div>
        <div>
          <div className="text-sm font-bold" style={{ color: "var(--theme-gold)" }}>Goal complete!</div>
          <div className="text-xs" style={{ color: "var(--fg)" }}>
            You've completed <strong>{goal.name}</strong> — {goal.targetCount} items collected.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GoalsPage() {
  const [goals, setGoals] = useState(loadGoals);
  const [items, setItems] = useState(() => loadItems());
  const [showAdd, setShowAdd] = useState(false);
  const [sort, setSort] = useState<Sort>("progress");
  const [justCompleted, setJustCompleted] = useState<string | null>(null);

  useEffect(() => {
    const onFocus = () => { setGoals(loadGoals()); setItems(loadItems()); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const progress = useMemo(() => computeAllGoalProgress(goals, items), [goals, items]);

  const sorted = useMemo(() => {
    const list = [...progress];
    if (sort === "alpha")    return list.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "recent")   return list.sort((a, b) => b.createdAt - a.createdAt);
    // progress: complete last, then by % desc
    return list.sort((a, b) => {
      if (a.isComplete !== b.isComplete) return a.isComplete ? 1 : -1;
      return b.pct - a.pct;
    });
  }, [progress, sort]);

  const newlyComplete = progress.filter(g => g.isComplete);

  function handleAddToWishlist(goal: GoalProgress) {
    if (goal.missing <= 0) return;
    addWishlistItem({
      title: `${goal.name} – ${goal.missing} missing`,
      notes: `${goal.ownedCount} of ${goal.targetCount} owned (${goal.pct}% complete)`,
      universe: goal.universe,
      subject: goal.subject,
      priority: goal.isAlmostThere ? "high" : "medium",
    });
  }

  function handleDelete(id: string) {
    deleteGoal(id);
    setGoals(loadGoals());
    if (justCompleted === id) setJustCompleted(null);
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <div className="border-b border-[color:var(--border)]" style={{ background: "var(--surface)" }}>
        <div className="mx-auto max-w-2xl px-4 py-6">
          <div className="flex items-center gap-3">
            <Link href="/vault" className="text-sm" style={{ color: "var(--muted)" }}>Vault</Link>
            <span style={{ color: "var(--muted)" }}>/</span>
            <span className="text-sm font-semibold" style={{ color: "var(--fg)" }}>Goals</span>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: "var(--fg)" }}>Collection Goals</h1>
              <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                Track set completion, subject milestones, and collection targets.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="shrink-0 rounded-full px-4 py-2 text-sm font-semibold ring-1"
              style={{ background: "var(--theme-gold)", color: "#0B0B0B", border: "none" }}
            >
              + Add Goal
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-6 space-y-4">
        {/* Overview */}
        <OverviewCard goals={progress} />

        {/* Celebrations */}
        {newlyComplete.slice(0, 1).map(g => (
          <CelebrationBanner key={g.id} goal={g} />
        ))}

        {/* Sort bar */}
        {progress.length > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: "var(--muted)" }}>{progress.length} goal{progress.length !== 1 ? "s" : ""}</span>
            <div className="flex gap-1 rounded-xl p-1" style={{ background: "var(--pill)" }}>
              {([["progress", "Progress"], ["alpha", "A→Z"], ["recent", "Recent"]] as [Sort, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setSort(key)}
                  className="rounded-lg px-3 py-1 text-xs font-semibold transition"
                  style={sort === key ? { background: "var(--theme-gold)", color: "#0B0B0B" } : { color: "var(--muted)" }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Goals list */}
        {sorted.length === 0 ? (
          <div
            className="rounded-2xl p-10 text-center ring-1 ring-[color:var(--border)]"
            style={{ background: "var(--surface)" }}
          >
            <div className="text-4xl">🎯</div>
            <div className="mt-4 text-base font-semibold" style={{ color: "var(--fg)" }}>No goals yet</div>
            <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
              Set a target — like "complete the 1984 Topps baseball set" or "collect 50 graded cards".
            </p>
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="mt-6 rounded-full px-5 py-2.5 text-sm font-semibold"
              style={{ background: "var(--theme-gold)", color: "#0B0B0B" }}
            >
              + Add your first goal
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onAddToWishlist={() => handleAddToWishlist(goal)}
                onDelete={() => handleDelete(goal.id)}
              />
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <AddGoalSheet
          onClose={() => setShowAdd(false)}
          onSave={(fields) => {
            addGoal(fields);
            setGoals(loadGoals());
            setShowAdd(false);
          }}
        />
      )}
    </div>
  );
}
