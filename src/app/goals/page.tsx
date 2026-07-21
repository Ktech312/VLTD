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
  syncGoalsFromSupabase,
  type GoalProgress,
} from "@/lib/collectionGoals";
import { loadItems } from "@/lib/vaultModel";
import { Glyph } from "@/components/ui/Glyph";
import { addWishlistItem } from "@/lib/wishlistModel";

type Sort = "progress" | "alpha" | "recent";

function MiniRing({ pct, size = 44 }: { pct: number; size?: number }) {
  const r = size / 2 - 5;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(100, Math.max(0, pct)) / 100) * circ;
  const color = pct >= 100 ? "var(--theme-gold)" : pct >= 80 ? "#52C27A" : pct >= 50 ? "var(--theme-gold)" : "#FF705C";
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={4} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={4} strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" />
    </svg>
  );
}

function StatCard({ label, value, helper, tone = "gold" }: { label: string; value: string | number; helper: string; tone?: "gold" | "cyan" | "green" }) {
  const color = tone === "cyan" ? "var(--info,#52D6F4)" : tone === "green" ? "#52C27A" : "var(--theme-gold,#F5B548)";
  return (
    <div className="rounded-[8px] border border-[color:var(--border)] p-4" style={{ background: "var(--theme-card,rgba(15,25,45,0.85))" }}>
      <div className="text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: "var(--theme-text-muted,#A0956B)" }}>{label}</div>
      <div className="mt-3 text-3xl font-black" style={{ color }}>{value}</div>
      <div className="text-sm" style={{ color: "var(--theme-text-muted,#A0956B)" }}>{helper}</div>
    </div>
  );
}

function GoalOverview({ goals }: { goals: GoalProgress[] }) {
  const total = goals.length;
  const avgPct = total === 0 ? 0 : Math.round(goals.reduce((sum, g) => sum + g.pct, 0) / total);
  return (
    <div className="rounded-[8px] border border-[color:var(--border)] p-4" style={{ background: "var(--theme-card,rgba(15,25,45,0.85))" }}>
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <MiniRing pct={avgPct} size={72} />
          <div className="absolute inset-0 grid place-items-center text-sm font-black">{avgPct}%</div>
        </div>
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: "var(--theme-text-muted,#A0956B)" }}>Average Completion</div>
          <div className="mt-2 text-3xl font-black" style={{ color: "var(--theme-text-primary,#F0EAD6)" }}>{total}</div>
          <div className="text-sm" style={{ color: "var(--theme-text-muted,#A0956B)" }}>active goals</div>
        </div>
      </div>
    </div>
  );
}

function CelebrationBanner({ goal }: { goal: GoalProgress }) {
  return (
    <div className="rounded-[8px] border px-5 py-4" style={{ background: "rgba(245,181,72,0.08)", borderColor: "rgba(245,181,72,0.28)" }}>
      <div className="flex items-center gap-3">
        <div style={{ color: "var(--theme-gold)" }}><Glyph name="trophy" size={26} /></div>
        <div>
          <div className="text-sm font-black" style={{ color: "var(--theme-gold)" }}>Goal complete</div>
          <div className="text-xs" style={{ color: "var(--fg)" }}>{goal.name} is complete with {goal.targetCount} items collected.</div>
        </div>
      </div>
    </div>
  );
}

export default function GoalsPage() {
  const [goals, setGoals] = useState(loadGoals);
  const [items, setItems] = useState(() => loadItems());
  const [showAdd, setShowAdd] = useState(false);
  const [sort, setSort] = useState<Sort>("progress");
  const [justCompleted, setJustCompleted] = useState<string | null>(null);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);

  useEffect(() => {
    const onFocus = () => { setGoals(loadGoals()); setItems(loadItems()); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  useEffect(() => {
    let active = true;
    void syncGoalsFromSupabase().then(() => {
      if (active) setGoals(loadGoals());
    });
    return () => { active = false; };
  }, []);

  const progress = useMemo(() => computeAllGoalProgress(goals, items), [goals, items]);
  const sorted = useMemo(() => {
    const list = [...progress];
    if (sort === "alpha") return list.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "recent") return list.sort((a, b) => b.createdAt - a.createdAt);
    return list.sort((a, b) => {
      if (a.isComplete !== b.isComplete) return a.isComplete ? 1 : -1;
      return b.pct - a.pct;
    });
  }, [progress, sort]);

  const selectedGoal = useMemo(
    () => sorted.find((goal) => goal.id === selectedGoalId) ?? sorted[0] ?? null,
    [sorted, selectedGoalId]
  );
  const newlyComplete = progress.filter((g) => g.isComplete);
  const completeCount = progress.filter((g) => g.isComplete).length;
  const almostCount = progress.filter((g) => g.isAlmostThere && !g.isComplete).length;
  const missingCount = progress.reduce((sum, g) => sum + Math.max(0, g.missing), 0);

  function handleAddToWishlist(goal: GoalProgress) {
    if (goal.missing <= 0) return;
    addWishlistItem({
      title: `${goal.name} - ${goal.missing} missing`,
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
    <main style={{ background: "var(--bg)" }}>
      <div className="mx-auto max-w-[1480px] px-4 py-7 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-[44px] leading-none tracking-[-0.03em]" style={{ color: "var(--theme-text-primary,#F0EAD6)" }}>Goals</h1>
            <p className="mt-2 text-sm" style={{ color: "var(--theme-text-muted,#A0956B)" }}>Track collection targets, completion gaps, and the next items worth chasing.</p>
          </div>
          <button type="button" onClick={() => setShowAdd(true)} className="rounded-[7px] px-5 py-3 text-sm font-black transition hover:brightness-110" style={{ background: "linear-gradient(135deg,#8B6914,#F5B548)", color: "#0B0B0B" }}>
            + Add Goal
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <GoalOverview goals={progress} />
          <StatCard label="Complete" value={completeCount} helper="finished goals" />
          <StatCard label="Almost There" value={almostCount} helper="close to completion" tone="green" />
          <StatCard label="Missing" value={missingCount} helper="items to targets" tone="cyan" />
        </div>

        {newlyComplete.slice(0, 1).map((g) => <div key={g.id} className="mt-4"><CelebrationBanner goal={g} /></div>)}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-[color:var(--border)] p-3" style={{ background: "var(--theme-card,rgba(15,25,45,0.85))" }}>
          <div className="flex gap-1 rounded-[7px] p-1" style={{ background: "var(--pill)" }}>
            {([["progress", "Progress"], ["alpha", "A-Z"], ["recent", "Recent"]] as [Sort, string][]).map(([key, label]) => (
              <button key={key} onClick={() => setSort(key)} className="rounded-[6px] px-4 py-2 text-xs font-black transition" style={sort === key ? { background: "rgba(245,181,72,0.16)", color: "var(--theme-gold,#F5B548)" } : { color: "var(--muted)" }}>
                {label}
              </button>
            ))}
          </div>
          <span className="text-xs" style={{ color: "var(--muted)" }}>{progress.length} goal{progress.length !== 1 ? "s" : ""}</span>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="min-w-0">
            {sorted.length === 0 ? (
              <div className="rounded-[8px] p-10 text-center ring-1 ring-[color:var(--border)]" style={{ background: "var(--theme-card,rgba(15,25,45,0.85))" }}>
                <div className="flex justify-center" style={{ color: "var(--theme-gold)" }}><Glyph name="target" size={42} /></div>
                <div className="mt-4 text-base font-semibold" style={{ color: "var(--fg)" }}>No goals yet</div>
                <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>Set a target for a set, subject, universe, or collection milestone.</p>
                <button type="button" onClick={() => setShowAdd(true)} className="mt-6 rounded-[7px] px-5 py-2.5 text-sm font-semibold" style={{ background: "var(--theme-gold)", color: "#0B0B0B" }}>+ Add your first goal</button>
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {sorted.map((goal) => (
                  <div key={goal.id} onClick={() => setSelectedGoalId(goal.id)} className="cursor-pointer">
                    <GoalCard goal={goal} onAddToWishlist={() => handleAddToWishlist(goal)} onDelete={() => handleDelete(goal.id)} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedGoal && (
            <aside className="h-fit rounded-[8px] border border-[rgba(245,181,72,0.22)] p-4 xl:sticky xl:top-24" style={{ background: "var(--theme-card,rgba(15,25,45,0.85))" }}>
              <div className="text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: "var(--theme-text-muted,#A0956B)" }}>Goal Details</div>
              <h2 className="mt-3 text-2xl font-black leading-tight" style={{ color: "var(--theme-text-primary,#F0EAD6)" }}>{selectedGoal.name}</h2>
              <div className="mt-4 flex items-center gap-4">
                <div className="relative">
                  <MiniRing pct={selectedGoal.pct} size={88} />
                  <div className="absolute inset-0 grid place-items-center text-lg font-black">{selectedGoal.pct}%</div>
                </div>
                <div className="text-sm" style={{ color: "var(--theme-text-muted,#A0956B)" }}>
                  <div><strong className="text-[color:var(--theme-text-primary,#F0EAD6)]">{selectedGoal.ownedCount}</strong> of {selectedGoal.targetCount} owned</div>
                  <div>{selectedGoal.missing > 0 ? `${selectedGoal.missing} items missing` : "Complete"}</div>
                </div>
              </div>
              {selectedGoal.notes && <p className="mt-4 rounded-[7px] border border-[rgba(245,181,72,0.14)] p-3 text-sm leading-6" style={{ color: "var(--theme-text-muted,#A0956B)" }}>{selectedGoal.notes}</p>}
              <div className="mt-4 grid gap-2">
                {selectedGoal.missing > 0 && !selectedGoal.isComplete && (
                  <button type="button" onClick={() => handleAddToWishlist(selectedGoal)} className="rounded-[7px] px-4 py-2 text-sm font-black" style={{ background: "linear-gradient(135deg,#8B6914,#F5B548)", color: "#0B0B0B" }}>
                    Add missing to Want List
                  </button>
                )}
                <Link href="/vault" className="rounded-[7px] border px-4 py-2 text-center text-sm font-bold" style={{ borderColor: "rgba(245,181,72,0.24)", color: "var(--theme-gold,#F5B548)" }}>Browse Vault</Link>
              </div>
            </aside>
          )}
        </div>
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
    </main>
  );
}
