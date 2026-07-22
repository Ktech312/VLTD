"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AddGoalSheet from "@/components/AddGoalSheet";
import {
  addGoal,
  computeAllGoalProgress,
  deleteGoal,
  loadGoals,
  syncGoalsFromSupabase,
  type GoalProgress,
} from "@/lib/collectionGoals";
import { addWishlistItem } from "@/lib/wishlistModel";
import { loadItems, type VaultItem } from "@/lib/vaultModel";
import { Glyph } from "@/components/ui/Glyph";
import { showToast } from "@/lib/toast";

type GoalFilter = "all" | "completion" | "value" | "insurance" | "sell" | "gallery";
type SortMode = "priority" | "progress" | "recent";

type GoalView = {
  id: string;
  name: string;
  type: GoalFilter;
  due: string;
  pct: number;
  ownedCount: number;
  targetCount: number;
  missing: number;
  valueImpact: number;
  visibility: "Private" | "Public";
  previewLabel: string;
  nextAction: string;
  actionLabel: string;
  notes?: string;
  real?: GoalProgress;
  thumbnails: string[];
};

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function Ring({ pct, size = 92 }: { pct: number; size?: number }) {
  const radius = size / 2 - 9;
  const circ = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, pct));
  const dash = (clamped / 100) * circ;
  const color = clamped >= 80 ? "#5ED578" : clamped >= 50 ? "#75C46B" : "var(--theme-gold,#F5B548)";

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="9" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ - dash}`}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-[24px] font-black" style={{ color: "var(--theme-text-primary,#F0EAD6)" }}>
        {clamped}%
      </div>
    </div>
  );
}

function SparkLine() {
  return (
    <svg viewBox="0 0 170 74" className="h-16 w-36" aria-label="Goal value graph">
      <defs>
        <linearGradient id="goalSpark" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#56D879" stopOpacity="0.34" />
          <stop offset="100%" stopColor="#56D879" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M8 62 L28 52 L42 46 L55 35 L70 42 L86 24 L101 30 L118 14 L133 21 L148 10 L162 16 L162 74 L8 74 Z" fill="url(#goalSpark)" />
      <path d="M8 62 L28 52 L42 46 L55 35 L70 42 L86 24 L101 30 L118 14 L133 21 L148 10 L162 16" fill="none" stroke="#56D879" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function thumbForItem(item: VaultItem | undefined) {
  if (item?.imageFrontUrl) return item.imageFrontUrl;
  const text = [item?.title, item?.universe, item?.category].filter(Boolean).join(" ").toLowerCase();
  if (text.includes("watch") || text.includes("rolex")) return "/universe-thumbnails/jewelry-apparel.png";
  if (text.includes("music") || text.includes("vinyl")) return "/collectibles/vinyl-record.png";
  if (text.includes("sport") || text.includes("jordan")) return "/collectibles/sports-slab.png";
  if (text.includes("game")) return "/collectibles/vault-intake-sprites.png";
  return "/collectibles/comic-slab.png";
}

function goalType(goal: GoalProgress): GoalFilter {
  const text = `${goal.name} ${goal.notes ?? ""} ${goal.universe ?? ""}`.toLowerCase();
  if (text.includes("insurance")) return "insurance";
  if (text.includes("sell") || text.includes("duplicate")) return "sell";
  if (text.includes("gallery") || text.includes("room")) return "gallery";
  if (text.includes("value") || text.includes("$")) return "value";
  return "completion";
}

function buildGoalViews(progress: GoalProgress[], items: VaultItem[]): GoalView[] {
  return progress.map((goal, index) => {
    const matching = items
      .filter((item) => {
        if (goal.subject?.trim()) return (item.subject ?? "").toLowerCase() === goal.subject.trim().toLowerCase();
        if (goal.universe) return item.universe === goal.universe;
        return true;
      })
      .slice(0, 5);

    const type = goalType(goal);
    const valueImpact = matching.reduce((sum, item) => sum + (item.currentValue ?? item.purchasePrice ?? 0), 0);

    return {
      id: goal.id,
      name: goal.name,
      type,
      due: index === 0 ? "Due Aug 31, 2025" : index === 1 ? "Due May 30, 2025" : "Due Dec 31, 2025",
      pct: goal.pct,
      ownedCount: goal.ownedCount,
      targetCount: goal.targetCount,
      missing: goal.missing,
      valueImpact,
      visibility: type === "gallery" ? "Public" : "Private",
      previewLabel: type === "insurance" ? "Top Items In Goal" : type === "gallery" ? "Gallery Preview" : type === "sell" ? "Duplicates Ready To List" : type === "value" ? "Value Progress" : "Recently Added",
      nextAction: goal.missing > 0 ? (type === "insurance" ? "Add purchase info" : `Find ${goal.missing} more`) : "Goal complete",
      actionLabel: type === "insurance" ? "Review items" : type === "gallery" ? "Create room" : type === "sell" ? "Review duplicates" : "View set",
      notes: goal.notes,
      real: goal,
      thumbnails: matching.length ? matching.map((item) => thumbForItem(item)) : ["/collectibles/comic-slab.png", "/collectibles/sports-slab.png", "/collectibles/vinyl-record.png"],
    };
  });
}

function StatPanel({
  label,
  children,
  icon,
}: {
  label: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="min-h-[116px] rounded-[7px] border border-[rgba(245,181,72,0.26)] p-4" style={{ background: "var(--theme-card,rgba(15,25,45,0.86))" }}>
      <div className="flex h-full items-center gap-4">
        {icon}
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: "var(--theme-text-muted,#A0956B)" }}>{label}</div>
          {children}
        </div>
      </div>
    </div>
  );
}

function GoalRow({
  goal,
  selected,
  onSelect,
  onWishlist,
}: {
  goal: GoalView;
  selected: boolean;
  onSelect: () => void;
  onWishlist: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="grid min-h-[110px] w-full grid-cols-[108px_minmax(220px,1.2fr)_minmax(250px,1fr)_220px] items-center gap-5 rounded-[7px] border p-4 text-left transition hover:-translate-y-0.5"
      style={{
        background: "var(--theme-card,rgba(15,25,45,0.88))",
        borderColor: selected ? "var(--theme-gold,#F5B548)" : "rgba(245,181,72,0.28)",
        boxShadow: selected ? "0 0 0 1px rgba(245,181,72,0.16), 0 18px 42px rgba(0,0,0,0.26)" : "none",
      }}
    >
      <Ring pct={goal.pct} size={82} />

      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="truncate font-serif text-[23px] font-black leading-tight" style={{ color: "var(--theme-text-primary,#F0EAD6)" }}>{goal.name}</h2>
          {goal.type === "insurance" && <Glyph name="shield" size={17} style={{ color: "var(--theme-gold,#F5B548)" }} />}
          {goal.type === "value" && <Glyph name="chart" size={17} style={{ color: "var(--theme-gold,#F5B548)" }} />}
          {goal.type === "gallery" && <Glyph name="exhibition" size={17} style={{ color: "var(--theme-gold,#F5B548)" }} />}
        </div>
        <div className="mt-2 text-sm font-bold" style={{ color: "var(--theme-gold,#F5B548)" }}>{goal.due}</div>
        <div className="mt-2 flex flex-wrap gap-5 text-sm" style={{ color: "var(--theme-text-primary,#F0EAD6)" }}>
          <span>{goal.ownedCount.toLocaleString()} of {goal.targetCount.toLocaleString()} {goal.type === "value" ? "value" : "items"}</span>
          <span>{goal.visibility === "Private" ? "Private" : "Public"}</span>
        </div>
      </div>

      <div className="min-w-0 border-l border-r border-[rgba(245,181,72,0.16)] px-5">
        <div className="mb-2 text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--theme-text-muted,#A0956B)" }}>{goal.previewLabel}</div>
        {goal.type === "value" ? (
          <div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-[#56D879]" style={{ width: `${Math.min(100, goal.pct)}%` }} />
            </div>
            <div className="mt-3 grid grid-cols-2 text-sm" style={{ color: "var(--theme-text-primary,#F0EAD6)" }}>
              <div><span className="block text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--theme-text-muted,#A0956B)" }}>Current value</span>{money(goal.ownedCount)}</div>
              <div><span className="block text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--theme-text-muted,#A0956B)" }}>Target</span>{money(goal.targetCount)}</div>
            </div>
          </div>
        ) : (
          <div className="flex gap-2 overflow-hidden">
            {goal.thumbnails.slice(0, 5).map((src, index) => (
              <div key={`${goal.id}-${src}-${index}`} className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[6px] border border-[rgba(245,181,72,0.26)] bg-black/20">
                <img src={src} alt="" className="max-h-12 max-w-12 object-contain" />
              </div>
            ))}
            {goal.missing > 0 && (
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[6px] border border-[rgba(245,181,72,0.26)] text-sm font-black" style={{ color: "var(--theme-gold,#F5B548)" }}>
                +{goal.missing}
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <div className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--theme-text-muted,#A0956B)" }}>Next Action</div>
        <div className="mt-1 text-lg font-bold leading-tight" style={{ color: "var(--theme-text-primary,#F0EAD6)" }}>{goal.nextAction}</div>
        <div className="text-xs" style={{ color: "var(--theme-text-muted,#A0956B)" }}>{goal.missing > 0 ? `${goal.missing} items missing` : "Ready"}</div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onWishlist();
          }}
          className="mt-3 rounded-[7px] border border-[rgba(245,181,72,0.36)] px-5 py-1.5 text-xs font-black"
          style={{ color: "var(--theme-gold,#F5B548)" }}
        >
          {goal.actionLabel}
        </button>
      </div>
    </button>
  );
}

export default function GoalsPage() {
  const [goals, setGoals] = useState(loadGoals);
  const [items, setItems] = useState(() => loadItems());
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState<GoalFilter>("all");
  const [sort, setSort] = useState<SortMode>("priority");
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [showAllGoalItems, setShowAllGoalItems] = useState(false);

  useEffect(() => {
    const onFocus = () => {
      setGoals(loadGoals());
      setItems(loadItems());
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  useEffect(() => {
    let active = true;
    void syncGoalsFromSupabase().then(() => {
      if (active) setGoals(loadGoals());
    });
    return () => {
      active = false;
    };
  }, []);

  const progress = useMemo(() => computeAllGoalProgress(goals, items), [goals, items]);
  const realGoalViews = useMemo(() => buildGoalViews(progress, items), [items, progress]);
  const goalViews = realGoalViews;
  const visibleGoals = useMemo(() => {
    let list = goalViews.filter((goal) => filter === "all" || goal.type === filter);
    if (sort === "progress") list = [...list].sort((a, b) => b.pct - a.pct);
    if (sort === "recent") list = [...list].reverse();
    if (sort === "priority") list = [...list].sort((a, b) => b.missing - a.missing);
    return list;
  }, [filter, goalViews, sort]);

  const selectedGoal = visibleGoals.find((goal) => goal.id === selectedGoalId) ?? visibleGoals[0] ?? null;
  const averageProgress = Math.round(goalViews.reduce((sum, goal) => sum + goal.pct, 0) / Math.max(1, goalViews.length));
  const goalValueImpact = goalViews.reduce((sum, goal) => sum + goal.valueImpact, 0);
  const insuranceGoal = goalViews.find((goal) => goal.type === "insurance") ?? null;
  const completed = goalViews.filter((goal) => goal.pct >= 100).length;

  function addGoalToWishlist(goal: GoalView) {
    if (!goal.real || goal.real.missing <= 0) return;
    addWishlistItem({
      title: `${goal.real.name} - ${goal.real.missing} missing`,
      notes: `${goal.real.ownedCount} of ${goal.real.targetCount} owned (${goal.real.pct}% complete)`,
      universe: goal.real.universe,
      subject: goal.real.subject,
      priority: goal.real.isAlmostThere ? "high" : "medium",
    });
  }

  async function shareGoal(goal: GoalView) {
    const text = [goal.name, goal.pct + "% complete", goal.missing > 0 ? goal.missing + " to go" : "Complete"].filter(Boolean).join(" — ");
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: goal.name, text });
        return;
      }
      await navigator.clipboard.writeText(text);
      showToast("Goal copied to clipboard");
    } catch {
      showToast("Couldn't share that goal.");
    }
  }

  function handleDeleteGoal(goal: GoalView) {
    if (!goal.real) return;
    deleteGoal(goal.real.id);
    setGoals(loadGoals());
    setSelectedGoalId(null);
  }

  return (
    <main style={{ background: "var(--bg)" }}>
      <div className="mx-auto grid max-w-[1480px] gap-6 px-4 py-6 sm:px-6 lg:px-8 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-serif text-[44px] leading-none tracking-[-0.03em]" style={{ color: "var(--theme-text-primary,#F0EAD6)" }}>Goals</h1>
              <p className="mt-2 text-sm" style={{ color: "var(--theme-text-muted,#A0956B)" }}>Turn a collection into a plan.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="rounded-[7px] px-5 py-3 text-sm font-black transition hover:brightness-110"
              style={{ background: "linear-gradient(135deg,#8B6914,#F5B548)", color: "#0B0B0B" }}
            >
              + Create Goal
            </button>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            {[
              ["all", "All Goals", "target"],
              ["completion", "Completion", "check"],
              ["value", "Value", "chart"],
              ["insurance", "Insurance", "shield"],
              ["sell", "Sell", "tag"],
              ["gallery", "Gallery", "exhibition"],
            ].map(([key, label, icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key as GoalFilter)}
                className="flex h-10 items-center gap-2 rounded-[7px] border px-4 text-sm font-bold"
                style={{
                  background: filter === key ? "rgba(245,181,72,0.16)" : "var(--theme-card,rgba(15,25,45,0.82))",
                  borderColor: filter === key ? "var(--theme-gold,#F5B548)" : "rgba(245,181,72,0.24)",
                  color: filter === key ? "var(--theme-gold,#F5B548)" : "var(--theme-text-primary,#F0EAD6)",
                }}
              >
                <Glyph name={icon as "target"} size={15} />
                {label}
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-0 overflow-hidden rounded-[7px] border border-[rgba(245,181,72,0.28)] lg:grid-cols-[1.2fr_1.15fr_1fr_1fr]" style={{ background: "var(--theme-card,rgba(15,25,45,0.86))" }}>
            <StatPanel label="Overall Progress" icon={<Ring pct={averageProgress} size={98} />}>
              <div className="mt-1 text-sm leading-6" style={{ color: "var(--theme-text-primary,#F0EAD6)" }}>
                <strong>{goalViews.filter((goal) => goal.pct > 0).length}</strong> of <strong>{goalViews.length}</strong> goals active<br />
                <span style={{ color: "var(--theme-gold,#F5B548)" }}>{goalViews.filter((goal) => goal.missing > 0).length} need work</span><br />
                <span style={{ color: "var(--theme-text-muted,#A0956B)" }}>{goalViews.filter((goal) => goal.pct === 0).length} not started</span>
              </div>
            </StatPanel>
            <StatPanel label="Goal Value Impact">
              <div className="mt-2 text-[32px] font-black text-[color:var(--info,#52D6F4)]">{money(goalValueImpact)}</div>
              <div className="flex items-end justify-between gap-2">
                <p className="text-sm leading-5" style={{ color: "var(--theme-text-muted,#A0956B)" }}>Potential increase across all goals</p>
                <SparkLine />
              </div>
            </StatPanel>
            <StatPanel label="Insurance Coverage" icon={<Glyph name="shield" size={34} style={{ color: "var(--theme-gold,#F5B548)" }} />}>
              <div className="text-[32px] font-black text-[color:var(--info,#52D6F4)]">{insuranceGoal?.pct ?? 0}%</div>
              <p className="text-sm" style={{ color: "var(--theme-text-muted,#A0956B)" }}>
                {insuranceGoal ? `${insuranceGoal.ownedCount} of ${insuranceGoal.targetCount} items` : "No insurance goal yet"}
              </p>
            </StatPanel>
            <StatPanel label="Completed This Year" icon={<Glyph name="check" size={34} style={{ color: "#8DD35F" }} />}>
              <div className="text-[32px] font-black text-[#8DD35F]">{completed}</div>
              <p className="text-sm" style={{ color: "var(--theme-text-muted,#A0956B)" }}>Great job! Keep building momentum.</p>
            </StatPanel>
          </div>

          <div className="mt-5 flex items-center justify-between">
            <h2 className="text-[12px] font-black uppercase tracking-[0.18em]" style={{ color: "var(--theme-gold,#F5B548)" }}>
              Active Goals <span className="ml-2 rounded-full border border-[rgba(245,181,72,0.24)] px-2 py-0.5 text-[11px]">{visibleGoals.length}</span>
            </h2>
            <div className="flex items-center gap-3 text-sm" style={{ color: "var(--theme-text-muted,#A0956B)" }}>
              <span>Sort by:</span>
              <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)} className="bg-transparent font-bold outline-none" style={{ color: "var(--theme-text-primary,#F0EAD6)" }}>
                <option value="priority">Priority</option>
                <option value="progress">Progress</option>
                <option value="recent">Recent</option>
              </select>
              <Glyph name="box" size={16} style={{ color: "var(--theme-gold,#F5B548)" }} />
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {visibleGoals.length === 0 && (
              <div className="grid min-h-[220px] place-items-center rounded-[7px] border border-[rgba(245,181,72,0.22)] text-center" style={{ background: "var(--theme-card,rgba(15,25,45,0.86))" }}>
                <div>
                  <Glyph name="target" size={42} style={{ color: "var(--theme-gold,#F5B548)" }} />
                  <h2 className="mt-4 text-xl font-black" style={{ color: "var(--theme-text-primary,#F0EAD6)" }}>No goals yet</h2>
                  <p className="mt-2 text-sm" style={{ color: "var(--theme-text-muted,#A0956B)" }}>Create a real target for a set, value, insurance readiness, gallery, or sale plan.</p>
                  <button
                    type="button"
                    onClick={() => setShowAdd(true)}
                    className="mt-5 rounded-[7px] px-5 py-3 text-sm font-black"
                    style={{ background: "linear-gradient(135deg,#8B6914,#F5B548)", color: "#0B0B0B" }}
                  >
                    + Add your first goal
                  </button>
                </div>
              </div>
            )}
            {visibleGoals.map((goal) => (
              <GoalRow
                key={goal.id}
                goal={goal}
                selected={selectedGoal?.id === goal.id}
                onSelect={() => setSelectedGoalId(goal.id)}
                onWishlist={() => addGoalToWishlist(goal)}
              />
            ))}
          </div>

          <section className="mt-4 rounded-[7px] border border-[rgba(245,181,72,0.22)] p-4" style={{ background: "var(--theme-card,rgba(15,25,45,0.86))" }}>
            <h2 className="mb-2 text-[12px] font-black uppercase tracking-[0.18em]" style={{ color: "var(--theme-gold,#F5B548)" }}>Upcoming Milestones</h2>
            <p className="text-sm leading-6" style={{ color: "var(--theme-text-muted,#A0956B)" }}>
              Milestones will appear here after goal due dates are added to the goal model.
            </p>
          </section>
        </section>

        {selectedGoal && (
          <aside className="h-fit rounded-[8px] border border-[rgba(245,181,72,0.32)] p-5 xl:sticky xl:top-24" style={{ background: "var(--theme-card,rgba(15,25,45,0.92))", boxShadow: "0 18px 55px rgba(0,0,0,0.26)" }}>
            <div className="flex items-start justify-between">
              <div className="flex gap-3">
                <Glyph name={selectedGoal.type === "insurance" ? "shield" : selectedGoal.type === "value" ? "chart" : selectedGoal.type === "gallery" ? "exhibition" : "target"} size={34} style={{ color: "var(--theme-gold,#F5B548)" }} />
                <div>
                  <h2 className="font-serif text-[25px] font-black leading-tight" style={{ color: "var(--theme-text-primary,#F0EAD6)" }}>{selectedGoal.name}</h2>
                  <div className="mt-2 flex gap-2 text-xs">
                    <span className="rounded-[4px] border border-[rgba(245,181,72,0.22)] px-2 py-1" style={{ color: "var(--theme-text-primary,#F0EAD6)" }}>{selectedGoal.visibility}</span>
                    <span className="rounded-[4px] border border-[rgba(245,181,72,0.22)] px-2 py-1" style={{ color: "var(--theme-gold,#F5B548)" }}>{selectedGoal.due.replace("Due ", "")}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-[#56D879]" style={{ width: `${selectedGoal.pct}%` }} />
                </div>
                <div className="ml-5 text-[38px] font-black text-[#56D879]">{selectedGoal.pct}%</div>
              </div>
              <div className="mt-2 text-sm" style={{ color: "var(--theme-text-muted,#A0956B)" }}>{selectedGoal.ownedCount} of {selectedGoal.targetCount} items ready</div>
            </div>

            <div className="mt-5 grid grid-cols-2 border-y border-[rgba(245,181,72,0.18)] py-4">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--theme-text-muted,#A0956B)" }}>Target</div>
                <div className="mt-1 text-lg font-black" style={{ color: "var(--theme-text-primary,#F0EAD6)" }}>{selectedGoal.targetCount.toLocaleString()} items</div>
                <div className="text-xs" style={{ color: "var(--theme-text-muted,#A0956B)" }}>Top items by value</div>
              </div>
              <div className="border-l border-[rgba(245,181,72,0.18)] pl-5">
                <div className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--theme-text-muted,#A0956B)" }}>Insurable Value</div>
                <div className="mt-1 text-[23px] font-black text-[color:var(--info,#52D6F4)]">{money(selectedGoal.valueImpact)}</div>
                <div className="text-xs" style={{ color: "var(--theme-text-muted,#A0956B)" }}>From matching vault items</div>
              </div>
            </div>

                        <section className="mt-5">
              <div className="mb-3 flex justify-between">
                <h3 className="text-[12px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--theme-gold,#F5B548)" }}>Goal Progress</h3>
                <span className="text-xs" style={{ color: "var(--theme-text-primary,#F0EAD6)" }}>{selectedGoal.ownedCount} / {selectedGoal.targetCount}</span>
              </div>
              {[
                ["Ready items", selectedGoal.ownedCount, selectedGoal.ownedCount >= selectedGoal.targetCount],
                ["Missing to target", selectedGoal.missing, selectedGoal.missing === 0],
                ["Current progress", selectedGoal.pct, selectedGoal.pct >= 100],
              ].map(([label, count, ok]) => (
                <div key={String(label)} className="grid grid-cols-[1fr_72px_22px] items-center gap-2 border-b border-[rgba(245,181,72,0.10)] py-2 text-sm">
                  <span style={{ color: "var(--theme-text-primary,#F0EAD6)" }}>{label}</span>
                  <span className="text-right" style={{ color: "var(--theme-text-muted,#A0956B)" }}>
                    {label === "Current progress" ? `${count}%` : Number(count).toLocaleString()}
                  </span>
                  <span className={ok ? "text-green-400" : "text-[color:var(--theme-gold,#F5B548)]"}>{ok ? "ok" : "!"}</span>
                </div>
              ))}
            </section>

            <section className="mt-5">
              <div className="mb-3 flex justify-between">
                <h3 className="text-[12px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--theme-gold,#F5B548)" }}>Next Work ({selectedGoal.missing})</h3>
              </div>
              <div className="rounded-[7px] border border-[rgba(245,181,72,0.14)] p-3 text-sm" style={{ color: "var(--theme-text-primary,#F0EAD6)" }}>
                <div className="font-black">{selectedGoal.nextAction}</div>
                <div className="mt-1 text-xs" style={{ color: "var(--theme-text-muted,#A0956B)" }}>
                  {selectedGoal.missing > 0
                    ? `${selectedGoal.missing} more ${selectedGoal.type === "value" ? "value" : "item"} ${selectedGoal.missing === 1 ? "step is" : "steps are"} needed for this goal.`
                    : "This goal is complete."}
                </div>
              </div>
            </section>

            <section className="mt-5">
              <h3 className="mb-3 text-[12px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--theme-gold,#F5B548)" }}>Suggested Action</h3>
              <Link
                href={selectedGoal.type === "insurance" ? "/insurance" : selectedGoal.type === "gallery" ? "/museum" : "/vault"}
                className="mb-2 grid w-full grid-cols-[34px_1fr_auto] items-center gap-2 rounded-[7px] border border-[rgba(245,181,72,0.16)] p-3 text-left transition hover:border-[rgba(245,181,72,0.4)]"
              >
                <Glyph name={selectedGoal.type === "insurance" ? "shield" : selectedGoal.type === "gallery" ? "exhibition" : "target"} size={20} style={{ color: "var(--theme-gold,#F5B548)" }} />
                <span>
                  <span className="block text-sm font-black" style={{ color: "var(--theme-text-primary,#F0EAD6)" }}>{selectedGoal.actionLabel}</span>
                  <span className="block text-xs" style={{ color: "var(--theme-text-muted,#A0956B)" }}>Uses the current goal and matching vault items.</span>
                </span>
                <span style={{ color: "var(--theme-gold,#F5B548)" }}>›</span>
              </Link>
            </section>

            <section className="mt-5">
              <div className="mb-3 flex justify-between">
                <h3 className="text-[12px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--theme-gold,#F5B548)" }}>Items In Goal ({selectedGoal.targetCount})</h3>
                <button type="button" onClick={() => setShowAllGoalItems((v) => !v)} className="text-xs font-bold" style={{ color: "var(--theme-gold,#F5B548)" }}>{showAllGoalItems ? "Show less" : "View all"}</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {(showAllGoalItems ? selectedGoal.thumbnails : selectedGoal.thumbnails.slice(0, 5)).map((src, index) => (
                  <div key={`${src}-${index}`} className="flex h-16 w-16 items-center justify-center rounded-[6px] border border-[rgba(245,181,72,0.22)] bg-black/20">
                    <img src={src} alt="" className="max-h-14 max-w-14 object-contain" />
                  </div>
                ))}
                {!showAllGoalItems && selectedGoal.targetCount > 5 && (
                  <div className="grid h-16 w-16 place-items-center rounded-[6px] border border-[rgba(245,181,72,0.22)] text-sm font-black" style={{ color: "var(--theme-gold,#F5B548)" }}>+{selectedGoal.targetCount - 5}</div>
                )}
              </div>
            </section>

            <div className="mt-5 grid gap-3">
              <button type="button" onClick={() => addGoalToWishlist(selectedGoal)} className="rounded-[7px] px-4 py-3 text-sm font-black" style={{ background: "linear-gradient(135deg,#8B6914,#F5B548)", color: "#0B0B0B" }}>
                Review items
              </button>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => shareGoal(selectedGoal)} className="rounded-[7px] border border-[rgba(245,181,72,0.22)] px-4 py-3 text-sm font-bold" style={{ color: "var(--theme-gold,#F5B548)" }}>Share goal</button>
                <button type="button" onClick={() => handleDeleteGoal(selectedGoal)} className="rounded-[7px] border border-red-500/45 px-4 py-3 text-sm font-bold text-red-400">Delete goal</button>
              </div>
            </div>
          </aside>
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
    </main>
  );
}
