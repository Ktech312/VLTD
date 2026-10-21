"use client";

import { WorkspaceActions } from "@/components/vault/VaultWorkspace";
import { PillButton } from "@/components/ui/PillButton";
import { PillSelect } from "@/components/ui/PillSelect";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AddGoalSheet from "@/components/AddGoalSheet";
import {
  addGoal,
  computeAllGoalProgress,
  deleteGoal,
  loadGoals,
  legacyDeviceWideGoalCount,
  pendingGoalCounts,
  retryPendingGoals,
  syncGoalsFromSupabaseChecked,
  updateGoal,
  describeGoalProgress,
  type GoalKind,
  type GoalProgress,
} from "@/lib/collectionGoals";
import { addWishlistItem } from "@/lib/wishlistModel";
import { loadItems, resetCloudBackoff, syncVaultItemsFromSupabaseChecked, type VaultItem } from "@/lib/vaultModel";
import { activeItems as ownedItems, summarizeValues } from "@/lib/vaultStats";
import { loadWishlist } from "@/lib/wishlistModel";
import { LoadErrorCard, StaleDataNotice } from "@/components/vault/CloudStatus";
import { Glyph } from "@/components/ui/Glyph";
import { showToast } from "@/lib/toast";
import { subscribeCloudSave } from "@/lib/cloudSaveStatus";
import { universePlaceholder } from "@/lib/itemPlaceholder";

// How a goal is measured is stored with it (items or value); a goal made before that existed is "setup" until the person chooses.
type GoalFilter = "all" | "count" | "value" | "setup";
type SortMode = "priority" | "progress" | "recent";

const GOAL_FILTERS: [GoalFilter, string, string][] = [
  ["all", "All Goals", "target"],
  ["count", "Items", "check"],
  ["value", "Value", "chart"],
  ["setup", "Needs setup", "warning"],
];

type GoalView = {
  id: string;
  name: string;
  type: GoalFilter;
  pct: number;
  ownedCount: number;
  targetCount: number;
  missing: number;
  /** The value of the owned items this goal covers (never sold or wishlist items). */
  valueImpact: number;
  visibility: "Private" | "Public";
  previewLabel: string;
  needsSetup: boolean;
  progressText: string;
  /** How many owned items the goal covers (not the goal's own number). */
  scopeCount: number;
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

function Ring({ pct, size = 92, label }: { pct: number; size?: number; label?: string }) {
  const radius = size / 2 - 9;
  const circ = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, pct));
  const dash = (clamped / 100) * circ;
  const color = clamped >= 80 ? "#5ED578" : clamped >= 50 ? "#75C46B" : "var(--theme-gold,#C8CDD2)";

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
      <div className="absolute inset-0 grid place-items-center text-[24px] font-black" style={{ color: "var(--theme-text-primary,#ECEDEF)" }}>
        {label ?? `${clamped}%`}
      </div>
    </div>
  );
}

function thumbForItem(item: VaultItem | undefined) {
  // Real photo when the item has one, else a Universe-matched placeholder — no
  // keyword-guessed stock art pretending to be the item.
  return item?.imageFrontUrl || universePlaceholder(item?.universe);
}

function buildGoalViews(progress: GoalProgress[], items: VaultItem[]): GoalView[] {
  return progress.map((goal, index) => {
    const ownedAll = items.filter((item) => item.status !== "SOLD" && item.status !== "WISHLIST").filter((item) => {
      if (goal.subject?.trim()) return (item.subject ?? "").toLowerCase() === goal.subject.trim().toLowerCase();
      if (goal.universe) return item.universe === goal.universe;
      return true;
    });
    const ownedMatching = ownedAll.slice(0, 60);

    // The goal's own stored kind. Never worked out from its name or notes.
    const type: GoalFilter = goal.needsSetup ? "setup" : goal.kind === "value" ? "value" : "count";
    // What the owned items in this goal's scope are worth (the one value rule). Sold and wishlist items are not owned and add nothing.
    const valueImpact = Math.round(summarizeValues(ownedItems(ownedAll)).totalValue);

    return {
      id: goal.id,
      name: goal.name,
      type,
      pct: goal.pct,
      ownedCount: goal.ownedCount,
      targetCount: goal.targetCount,
      missing: goal.missing,
      valueImpact,
      visibility: "Private",
      previewLabel: type === "value" ? "Value Progress" : type === "setup" ? "Not measured yet" : "Recently Added",
      needsSetup: goal.needsSetup,
      progressText: describeGoalProgress(goal),
      scopeCount: ownedAll.length,
      nextAction: type === "setup" ? "Choose how to measure it" : goal.missing > 0 ? (type === "value" ? `${money(goal.missing)} to go` : `Find ${goal.missing} more`) : "Goal complete",
      actionLabel: type === "setup" ? "Set up goal" : type === "value" ? "Review values" : "View set",
      notes: goal.notes,
      real: goal,
      thumbnails: ownedMatching.length ? ownedMatching.map((item) => thumbForItem(item)) : [universePlaceholder(goal.universe)],
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
    <div className="min-h-[116px] rounded-[7px] border border-[rgba(203,208,213,0.26)] p-4" style={{ background: "var(--theme-card,rgba(15,25,45,0.86))" }}>
      <div className="flex h-full items-center gap-4">
        {icon}
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: "var(--theme-text-muted,#61656B)" }}>{label}</div>
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
  onConfigure,
}: {
  goal: GoalView;
  selected: boolean;
  onSelect: () => void;
  onWishlist: () => void;
  onConfigure: (kind: GoalKind) => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="grid min-h-[110px] w-full grid-cols-[82px_minmax(0,1fr)] items-center gap-x-4 gap-y-3 rounded-[7px] border p-4 text-left transition hover:-translate-y-0.5 lg:grid-cols-[108px_minmax(220px,1.2fr)_minmax(250px,1fr)_220px] lg:gap-5"
      style={{
        background: "var(--theme-card,rgba(15,25,45,0.88))",
        borderColor: selected ? "var(--theme-gold,#C8CDD2)" : "rgba(203,208,213,0.28)",
        boxShadow: selected ? "0 0 0 1px rgba(203,208,213,0.16), 0 18px 42px rgba(0,0,0,0.26)" : "none",
      }}
    >
      <Ring pct={goal.pct} size={82} label={goal.needsSetup ? "—" : undefined} />

      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="truncate font-serif text-[23px] font-black leading-tight" style={{ color: "var(--theme-text-primary,#ECEDEF)" }}>{goal.name}</h2>
          {goal.type === "value" && <Glyph name="chart" size={17} style={{ color: "var(--theme-gold,#C8CDD2)" }} />}
        </div>
        <div className="mt-2 flex flex-wrap gap-5 text-sm" style={{ color: "var(--theme-text-primary,#ECEDEF)" }}>
          <span data-testid="goal-progress-text">{goal.progressText}</span>
          <span>{goal.visibility === "Private" ? "Private" : "Public"}</span>
        </div>
      </div>

      <div className="min-w-0 border-[rgba(203,208,213,0.16)] max-lg:col-span-2 lg:border-l lg:border-r lg:px-5">
        <div className="mb-2 text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--theme-text-muted,#61656B)" }}>{goal.previewLabel}</div>
        {goal.type === "setup" ? (
          <p className="text-sm" style={{ color: "var(--theme-text-muted,#61656B)" }}>
            This goal was made before goals had a type. It has a target of {goal.targetCount.toLocaleString()}, but nothing says whether that is items or dollars, so no progress is shown until you choose.
          </p>
        ) : goal.type === "value" ? (
          <div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-[#56D879]" style={{ width: `${Math.min(100, goal.pct)}%` }} />
            </div>
            <div className="mt-3 grid grid-cols-2 text-sm" style={{ color: "var(--theme-text-primary,#ECEDEF)" }}>
              <div><span className="block text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--theme-text-muted,#61656B)" }}>Current value</span>{money(goal.ownedCount)}</div>
              <div><span className="block text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--theme-text-muted,#61656B)" }}>Target</span>{money(goal.targetCount)}</div>
            </div>
          </div>
        ) : (
          <div className="flex gap-2 overflow-hidden">
            {goal.thumbnails.slice(0, 5).map((src, index) => (
              <div key={`${goal.id}-${src}-${index}`} className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[6px] border border-[rgba(203,208,213,0.26)] bg-black/20">
                <img src={src} alt="" className="max-h-12 max-w-12 object-contain" />
              </div>
            ))}
            {goal.missing > 0 && (
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[6px] border border-[rgba(203,208,213,0.26)] text-sm font-black" style={{ color: "var(--theme-gold,#C8CDD2)" }}>
                +{goal.missing}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="max-lg:col-span-2">
        <div className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--theme-text-muted,#61656B)" }}>Next Action</div>
        <div className="mt-1 text-lg font-bold leading-tight" style={{ color: "var(--theme-text-primary,#ECEDEF)" }}>{goal.nextAction}</div>
        <div className="text-xs" style={{ color: "var(--theme-text-muted,#61656B)" }}>{goal.type === "setup" ? "Not set up" : goal.type === "value" ? (goal.missing > 0 ? `${money(goal.missing)} short` : "Reached") : goal.missing > 0 ? `${goal.missing} items missing` : "Ready"}</div>
        {goal.type === "setup" ? (
          <div className="mt-3 flex flex-wrap gap-2" data-testid="goal-setup-choices">
            <button type="button" onClick={(event) => { event.stopPropagation(); onConfigure("count"); }} className="rounded-[7px] border border-[rgba(203,208,213,0.36)] px-3 py-1.5 text-xs font-black max-md:min-h-11" style={{ color: "var(--theme-gold,#C8CDD2)" }}>Count items</button>
            <button type="button" onClick={(event) => { event.stopPropagation(); onConfigure("value"); }} className="rounded-[7px] border border-[rgba(203,208,213,0.36)] px-3 py-1.5 text-xs font-black max-md:min-h-11" style={{ color: "var(--theme-gold,#C8CDD2)" }}>Measure value ($)</button>
          </div>
        ) : null}
        {goal.type === "count" ? <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onWishlist();
          }}
          disabled={goal.missing <= 0}
          title={goal.missing > 0 ? "Adds what is missing from this goal to your wishlist" : "Nothing is missing: this goal is complete"}
          className="mt-3 rounded-[7px] border border-[rgba(203,208,213,0.36)] px-5 py-1.5 text-xs font-black max-md:min-h-11 disabled:cursor-not-allowed disabled:opacity-60"
          style={{ color: "var(--theme-gold,#C8CDD2)" }}
        >
          {goal.missing > 0 ? "Add missing to Wishlist" : "Goal complete"}
        </button> : null}
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
  // Until goals have been read from the account once, an empty list means "not loaded yet", not "no goals".
  const [goalsLoaded, setGoalsLoaded] = useState(false);
  // Goal changes the account has not confirmed yet (saved or deleted on this device only): said out loud, never silent.
  const [waiting, setWaiting] = useState({ saves: 0, deletes: 0 });
  const [retrying, setRetrying] = useState(false);
  // True when the account could not be read: the saved copy (possibly none) is on screen, and an empty list is not "no goals".
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // Goals an older version left on this device that cannot be tied to this account: kept, never added automatically.
  const [legacyHeld, setLegacyHeld] = useState(0);
  const refreshWaiting = () => setWaiting(pendingGoalCounts());

  useEffect(() => {
    const onFocus = () => {
      setGoals(loadGoals());
      setItems(loadItems());
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("vltd:vault-updated", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("vltd:vault-updated", onFocus);
    };
  }, []);

  // The retry timer and the Retry button both change what is waiting: keep the notice and the list in step with the status pill.
  useEffect(() => {
    return subscribeCloudSave(() => {
      setWaiting(pendingGoalCounts());
      setGoals(loadGoals());
    });
  }, []);

  useEffect(() => {
    let active = true;
    // A pull that never answers must not leave "Loading your goals…" on screen for ever.
    const timer = window.setTimeout(() => {
      if (active) { setLoadFailed(true); setGoalsLoaded(true); }
    }, 20_000);
    // Progress is measured against the account's items, so they are pulled too (not only what this device already holds).
    void syncVaultItemsFromSupabaseChecked().then(() => { if (active) setItems(loadItems()); }).catch(() => undefined);
    void syncGoalsFromSupabaseChecked().then((result) => {
      if (!active) return;
      setGoals(loadGoals());
      setLoadFailed(!result.ok);
    }).catch(() => { if (active) setLoadFailed(true); }).finally(() => {
      window.clearTimeout(timer);
      if (active) {
        setGoalsLoaded(true);
        refreshWaiting();
        setLegacyHeld(legacyDeviceWideGoalCount());
      }
    });
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [attempt]);

  const retryGoalsLoad = () => {
    resetCloudBackoff();
    setGoalsLoaded(false);
    setLoadFailed(false);
    setAttempt((n) => n + 1);
  };

  const progress = useMemo(() => computeAllGoalProgress(goals, items), [goals, items]);
  const realGoalViews = useMemo(() => buildGoalViews(progress, items), [items, progress]);
  const goalViews = realGoalViews;
  const visibleGoals = useMemo(() => {
    let list = goalViews.filter((goal) => filter === "all" || goal.type === filter);
    if (sort === "progress") list = [...list].sort((a, b) => b.pct - a.pct);
    if (sort === "recent") list = [...list].sort((a, b) => (b.real?.createdAt ?? 0) - (a.real?.createdAt ?? 0));
    if (sort === "priority") list = [...list].sort((a, b) => b.missing - a.missing);
    return list;
  }, [filter, goalViews, sort]);

  const selectedGoal = visibleGoals.find((goal) => goal.id === selectedGoalId) ?? visibleGoals[0] ?? null;
  // Goals that are not set up have no progress to average or count.
  const measured = goalViews.filter((goal) => !goal.needsSetup);
  const needSetup = goalViews.length - measured.length;
  const averageProgress = Math.round(measured.reduce((sum, goal) => sum + goal.pct, 0) / Math.max(1, measured.length));
  // A potential increase can only be stated for goals that are measured in dollars: the dollars still to reach. Item goals have no dollar figure to add up.
  const valueGoalViews = goalViews.filter((goal) => goal.type === "value");
  const goalValueImpact = valueGoalViews.reduce((sum, goal) => sum + goal.missing, 0);
  const completed = measured.filter((goal) => goal.pct >= 100).length;
  const countGoals = goalViews.filter((goal) => goal.type === "count").length;
  const valueGoals = goalViews.filter((goal) => goal.type === "value").length;

  function addGoalToWishlist(goal: GoalView) {
    if (!goal.real || goal.type !== "count" || goal.real.missing <= 0) return;
    const title = `${goal.real.name} - ${goal.real.missing} missing`;
    if (loadWishlist().some((entry) => entry.title === title)) {
      showToast("Already on your wishlist.");
      return;
    }
    showToast(`Added to your wishlist: ${title}`);
    addWishlistItem({
      title,
      notes: `${goal.real.ownedCount} of ${goal.real.targetCount} owned (${goal.real.pct}% complete)`,
      universe: goal.real.universe,
      subject: goal.real.subject,
      priority: goal.real.isAlmostThere ? "high" : "medium",
    });
  }

  // The person picks how an older goal is measured. Its stored number is kept; only the unit is chosen.
  async function configureGoal(goal: GoalView, kind: GoalKind) {
    if (!goal.real) return;
    const result = await updateGoal(goal.real.id, { goalType: kind });
    setGoals(loadGoals());
    refreshWaiting();
    if (!result.ok) showToast(result.error);
    else if (result.typeOnDeviceOnly) showToast("Saved. How this goal is measured is kept on this device until your account can store it.");
    else if (result.pending) showToast("Saved on this device. Sync pending: your account will be updated when the connection is back.");
    else showToast(kind === "value" ? "This goal now measures collection value." : "This goal now counts items.");
  }

  async function shareGoal(goal: GoalView) {
    const text = goal.needsSetup ? goal.name : [goal.name, goal.pct + "% complete", goal.missing > 0 ? (goal.type === "value" ? money(goal.missing) : goal.missing) + " to go" : "Complete"].filter(Boolean).join(" — ");
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

  async function handleDeleteGoal(goal: GoalView) {
    if (!goal.real) return;
    if (!window.confirm(`Delete the goal "${goal.name}"? This can't be undone.`)) return;
    setSelectedGoalId(null);
    const result = await deleteGoal(goal.real.id);
    setGoals(loadGoals());
    refreshWaiting();
    if (!result.ok) showToast(result.error + " It is back in your list.");
    else if (result.pending) showToast("Deleted on this device. Sync pending: your account will be updated when the connection is back.");
  }

  async function handleRetryWaiting() {
    setRetrying(true);
    await retryPendingGoals().catch(() => undefined);
    setGoals(loadGoals());
    refreshWaiting();
    setRetrying(false);
  }

  return (
    <>
      <WorkspaceActions>
        <PillButton onClick={() => setShowAdd(true)} className="font-black" style={{ background: "linear-gradient(180deg, #79E7FB, #41C6E4 55%, #2CB1D1)", color: "#06171d", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5), 0 0 16px rgba(79,211,238,0.25)" }}>
          + Create Goal
        </PillButton>
      </WorkspaceActions>
      <main style={{ background: "var(--bg)" }}>
      <div className="mx-auto grid max-w-[1480px] gap-6 px-4 pb-6 sm:px-6 lg:px-8 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="min-w-0">
          {legacyHeld > 0 ? (
            <div role="status" data-testid="goals-legacy-note" className="mt-2 rounded-[7px] border border-[rgba(203,208,213,0.28)] px-4 py-3 text-sm" style={{ color: "var(--theme-text-primary,#ECEDEF)" }}>
              {legacyHeld} goal{legacyHeld === 1 ? "" : "s"} saved on this device by an older version cannot be matched to your account, so {legacyHeld === 1 ? "it was" : "they were"} not added. {legacyHeld === 1 ? "It is" : "They are"} kept on this device, untouched.
            </div>
          ) : null}
          {waiting.saves + waiting.deletes > 0 ? (
            <div role="status" data-testid="goals-waiting" className="mt-2 flex flex-wrap items-center gap-3 rounded-[7px] border border-[rgba(203,208,213,0.28)] px-4 py-3 text-sm" style={{ color: "var(--theme-text-primary,#ECEDEF)" }}>
              <span>
                {[waiting.saves > 0 ? `${waiting.saves} goal ${waiting.saves === 1 ? "change is" : "changes are"} saved on this device only` : "", waiting.deletes > 0 ? `${waiting.deletes} deleted ${waiting.deletes === 1 ? "goal is" : "goals are"} still on your account` : ""].filter(Boolean).join("; ")}. Sync pending.
              </span>
              <PillButton onClick={() => void handleRetryWaiting()} disabled={retrying}>{retrying ? "Retrying…" : "Retry now"}</PillButton>
            </div>
          ) : null}
          {goalViews.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-3" role="group" aria-label="Goal types">
              {GOAL_FILTERS.map(([key, label, icon]) => (
                <PillButton key={key} variant={filter === key ? "active" : "default"} pressed={filter === key} onClick={() => setFilter(key as GoalFilter)}>
                  <Glyph name={icon as "target"} size={16} />
                  {label}
                </PillButton>
              ))}
            </div>
          ) : null}

          <div className="mt-5 grid gap-0 overflow-hidden rounded-[7px] border border-[rgba(203,208,213,0.28)] lg:grid-cols-[1.2fr_1.15fr_1fr_1fr]" style={{ background: "var(--theme-card,rgba(15,25,45,0.86))" }}>
            <StatPanel label="Overall Progress" icon={<Ring pct={averageProgress} size={98} />}>
              <div className="mt-1 text-sm leading-6" style={{ color: "var(--theme-text-primary,#ECEDEF)" }}>
                <strong>{measured.filter((goal) => goal.pct > 0).length}</strong> of <strong>{measured.length}</strong> goals active<br />
                <span style={{ color: "var(--theme-gold,#C8CDD2)" }}>{measured.filter((goal) => goal.missing > 0).length} need work</span><br />
                <span style={{ color: "var(--theme-text-muted,#61656B)" }}>{measured.filter((goal) => goal.pct === 0).length} not started{needSetup > 0 ? ` · ${needSetup} need setup` : ""}</span>
              </div>
            </StatPanel>
            <StatPanel label="Value Still To Reach">
              <div className="mt-2 text-[32px] font-black text-[color:var(--info,#52D6F4)]">{valueGoalViews.length > 0 ? money(goalValueImpact) : "—"}</div>
              <p className="text-sm leading-5" style={{ color: "var(--theme-text-muted,#61656B)" }}>{valueGoalViews.length > 0 ? `Across your ${valueGoalViews.length} value ${valueGoalViews.length === 1 ? "goal" : "goals"}` : "You have no value goals yet. Item goals have no dollar figure."}</p>
            </StatPanel>
            <StatPanel label="Measured By" icon={<Glyph name="chart" size={34} style={{ color: "var(--theme-gold,#C8CDD2)" }} />}>
              <div className="text-sm leading-6" style={{ color: "var(--theme-text-primary,#ECEDEF)" }} data-testid="goals-measured-by">
                <strong>{countGoals}</strong> by items<br />
                <strong>{valueGoals}</strong> by value<br />
                <span style={{ color: needSetup > 0 ? "var(--theme-gold,#C8CDD2)" : "var(--theme-text-muted,#61656B)" }}>{needSetup} need setup</span>
              </div>
            </StatPanel>
            <StatPanel label="Completed Goals" icon={<Glyph name="check" size={34} style={{ color: "#8DD35F" }} />}>
              <div className="text-[32px] font-black text-[#8DD35F]">{completed}</div>
              <p className="text-sm" style={{ color: "var(--theme-text-muted,#61656B)" }}>Great job! Keep building momentum.</p>
            </StatPanel>
          </div>

          <div className="mt-5 flex items-center justify-between">
            <h2 className="text-[12px] font-black uppercase tracking-[0.18em]" style={{ color: "var(--theme-gold,#C8CDD2)" }}>
              Active Goals <span className="ml-2 rounded-full border border-[rgba(203,208,213,0.24)] px-2 py-0.5 text-[11px]">{visibleGoals.length}</span>
            </h2>
            <div className="flex items-center gap-3 text-sm" style={{ color: "var(--theme-text-muted,#61656B)" }}>
              <span>Sort by:</span>
              <PillSelect
                value={sort}
                ariaLabel="Sort goals"
                align="right"
                minWidthPx={130}
                onChange={(next) => setSort(next)}
                options={[
                  { value: "priority", label: "Priority" },
                  { value: "progress", label: "Progress" },
                  { value: "recent", label: "Recent" },
                ]}
              />
              <Glyph name="box" size={16} style={{ color: "var(--theme-gold,#C8CDD2)" }} />
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {loadFailed && goalViews.length > 0 ? <StaleDataNotice onRetry={retryGoalsLoad} /> : null}
            {visibleGoals.length === 0 && !goalsLoaded && (
              <div role="status" className="grid min-h-[220px] place-items-center rounded-[7px] border border-[rgba(203,208,213,0.22)] text-sm" style={{ background: "var(--theme-card,rgba(15,25,45,0.86))", color: "var(--theme-text-muted,#61656B)" }}>
                Loading your goals…
              </div>
            )}
            {visibleGoals.length === 0 && goalsLoaded && goalViews.length > 0 && (
              <div className="grid min-h-[160px] place-items-center rounded-[7px] border border-[rgba(203,208,213,0.22)] p-6 text-center" style={{ background: "var(--theme-card,rgba(15,25,45,0.86))" }} data-testid="goals-filter-empty">
                <div>
                  <h2 className="text-lg font-black" style={{ color: "var(--theme-text-primary,#ECEDEF)" }}>No {GOAL_FILTERS.find(([key]) => key === filter)?.[1] ?? ""} goals</h2>
                  <p className="mt-1 text-sm" style={{ color: "var(--theme-text-muted,#61656B)" }}>You have {goalViews.length} {goalViews.length === 1 ? "goal" : "goals"}, but none of this type.</p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <PillButton onClick={() => setFilter("all")}>Show all goals</PillButton>
                    <PillButton variant="active" onClick={() => setShowAdd(true)}>+ Create Goal</PillButton>
                  </div>
                </div>
              </div>
            )}
            {visibleGoals.length === 0 && goalsLoaded && goalViews.length === 0 && loadFailed && (
              <LoadErrorCard what="goals" onRetry={retryGoalsLoad} />
            )}
            {visibleGoals.length === 0 && goalsLoaded && goalViews.length === 0 && !loadFailed && (
              <div className="grid min-h-[220px] place-items-center rounded-[7px] border border-[rgba(203,208,213,0.22)] text-center" style={{ background: "var(--theme-card,rgba(15,25,45,0.86))" }}>
                <div>
                  <Glyph name="target" size={42} style={{ color: "var(--theme-gold,#C8CDD2)" }} />
                  <h2 className="mt-4 text-xl font-black" style={{ color: "var(--theme-text-primary,#ECEDEF)" }}>No goals yet</h2>
                  <p className="mx-auto mt-2 max-w-md text-sm" style={{ color: "var(--theme-text-muted,#61656B)" }}>A goal is something you are working toward: completing a set, reaching a collection value, building an exhibition, or selling duplicates. Create one and its progress is tracked here from the items in your Vault.</p>
                  <PillButton variant="active" className="mt-5 font-black" onClick={() => setShowAdd(true)}>+ Create Goal</PillButton>
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
                onConfigure={(kind) => void configureGoal(goal, kind)}
              />
            ))}
          </div>

        </section>

        {selectedGoal && (
          <aside className="h-fit rounded-[8px] border border-[rgba(203,208,213,0.32)] p-5 xl:sticky xl:top-24" style={{ background: "var(--theme-card,rgba(15,25,45,0.92))", boxShadow: "0 18px 55px rgba(0,0,0,0.26)" }}>
            <div className="flex items-start justify-between">
              <div className="flex gap-3">
                <Glyph name={selectedGoal.type === "value" ? "chart" : "target"} size={34} style={{ color: "var(--theme-gold,#C8CDD2)" }} />
                <div>
                  <h2 className="font-serif text-[25px] font-black leading-tight" style={{ color: "var(--theme-text-primary,#ECEDEF)" }}>{selectedGoal.name}</h2>
                  <div className="mt-2 flex gap-2 text-xs">
                    <span className="rounded-[4px] border border-[rgba(203,208,213,0.22)] px-2 py-1" style={{ color: "var(--theme-text-primary,#ECEDEF)" }}>{selectedGoal.visibility}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-[#56D879]" style={{ width: `${selectedGoal.pct}%` }} />
                </div>
                <div className="ml-5 text-[38px] font-black text-[#56D879]">{selectedGoal.needsSetup ? "—" : `${selectedGoal.pct}%`}</div>
              </div>
              <div className="mt-2 text-sm" style={{ color: "var(--theme-text-muted,#61656B)" }}>{selectedGoal.progressText}</div>
              {selectedGoal.needsSetup ? (
                <div className="mt-3 flex flex-wrap gap-2" data-testid="goal-setup-choices-panel">
                  <button type="button" onClick={() => void configureGoal(selectedGoal, "count")} className="rounded-[7px] border border-[rgba(203,208,213,0.36)] px-3 py-2 text-xs font-black max-md:min-h-11" style={{ color: "var(--theme-gold,#C8CDD2)" }}>Count items ({selectedGoal.targetCount.toLocaleString()} items)</button>
                  <button type="button" onClick={() => void configureGoal(selectedGoal, "value")} className="rounded-[7px] border border-[rgba(203,208,213,0.36)] px-3 py-2 text-xs font-black max-md:min-h-11" style={{ color: "var(--theme-gold,#C8CDD2)" }}>Measure value ({money(selectedGoal.targetCount)})</button>
                </div>
              ) : null}
            </div>

            <div className="mt-5 grid grid-cols-2 border-y border-[rgba(203,208,213,0.18)] py-4">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--theme-text-muted,#61656B)" }}>Target</div>
                <div className="mt-1 text-lg font-black" style={{ color: "var(--theme-text-primary,#ECEDEF)" }}>{selectedGoal.type === "value" ? money(selectedGoal.targetCount) : selectedGoal.type === "setup" ? `${selectedGoal.targetCount.toLocaleString()} (not set up)` : `${selectedGoal.targetCount.toLocaleString()} items`}</div>
                <div className="text-xs" style={{ color: "var(--theme-text-muted,#61656B)" }}>{selectedGoal.type === "value" ? "Collection value to reach" : selectedGoal.type === "setup" ? "Items or dollars: you choose" : "Items in the complete set"}</div>
              </div>
              <div className="border-l border-[rgba(203,208,213,0.18)] pl-5">
                <div className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--theme-text-muted,#61656B)" }}>Value You Own Here</div>
                <div className="mt-1 text-[23px] font-black text-[color:var(--info,#52D6F4)]">{money(selectedGoal.valueImpact)}</div>
                <div className="text-xs" style={{ color: "var(--theme-text-muted,#61656B)" }}>Items you own that this goal covers (not sold or wishlist items)</div>
              </div>
            </div>

                        <section className="mt-5">
              <div className="mb-3 flex justify-between">
                <h3 className="text-[12px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--theme-gold,#C8CDD2)" }}>Goal Progress</h3>
                <span className="text-xs" style={{ color: "var(--theme-text-primary,#ECEDEF)" }}>{selectedGoal.needsSetup ? "Not set up" : selectedGoal.progressText}</span>
              </div>
              {[
                [selectedGoal.type === "value" ? "Value reached" : "Ready items", selectedGoal.ownedCount, selectedGoal.ownedCount >= selectedGoal.targetCount],
                ["Missing to target", selectedGoal.missing, selectedGoal.missing === 0],
                ["Current progress", selectedGoal.pct, selectedGoal.pct >= 100],
              ].map(([label, count, ok]) => (
                <div key={String(label)} className="grid grid-cols-[1fr_72px_22px] items-center gap-2 border-b border-[rgba(203,208,213,0.10)] py-2 text-sm">
                  <span style={{ color: "var(--theme-text-primary,#ECEDEF)" }}>{label}</span>
                  <span className="text-right" style={{ color: "var(--theme-text-muted,#61656B)" }}>
                    {selectedGoal.needsSetup ? "—" : label === "Current progress" ? `${count}%` : selectedGoal.type === "value" ? money(Number(count)) : Number(count).toLocaleString()}
                  </span>
                  <span className={ok ? "text-green-400" : "text-[color:var(--theme-gold,#C8CDD2)]"}>{ok ? "ok" : "!"}</span>
                </div>
              ))}
            </section>

            <section className="mt-5">
              <div className="mb-3 flex justify-between">
                <h3 className="text-[12px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--theme-gold,#C8CDD2)" }}>Next Work ({selectedGoal.missing})</h3>
              </div>
              <div className="rounded-[7px] border border-[rgba(203,208,213,0.14)] p-3 text-sm" style={{ color: "var(--theme-text-primary,#ECEDEF)" }}>
                <div className="font-black">{selectedGoal.nextAction}</div>
                <div className="mt-1 text-xs" style={{ color: "var(--theme-text-muted,#61656B)" }}>
                  {selectedGoal.needsSetup
                    ? "Choose how this goal is measured to see its progress."
                    : selectedGoal.missing > 0
                      ? selectedGoal.type === "value"
                        ? `${money(selectedGoal.missing)} more collection value is needed for this goal.`
                        : `${selectedGoal.missing} more ${selectedGoal.missing === 1 ? "item is" : "items are"} needed for this goal.`
                      : "This goal is complete."}
                </div>
              </div>
            </section>

            <section className="mt-5">
              <h3 className="mb-3 text-[12px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--theme-gold,#C8CDD2)" }}>Suggested Action</h3>
              <Link
                href="/vault"
                className="mb-2 grid w-full grid-cols-[34px_1fr_auto] items-center gap-2 rounded-[7px] border border-[rgba(203,208,213,0.16)] p-3 text-left transition hover:border-[rgba(203,208,213,0.4)]"
              >
                <Glyph name="target" size={20} style={{ color: "var(--theme-gold,#C8CDD2)" }} />
                <span>
                  <span className="block text-sm font-black" style={{ color: "var(--theme-text-primary,#ECEDEF)" }}>{selectedGoal.actionLabel}</span>
                  <span className="block text-xs" style={{ color: "var(--theme-text-muted,#61656B)" }}>Uses the current goal and matching vault items.</span>
                </span>
                <span style={{ color: "var(--theme-gold,#C8CDD2)" }}>›</span>
              </Link>
            </section>

            <section className="mt-5">
              <div className="mb-3 flex justify-between">
                <h3 className="text-[12px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--theme-gold,#C8CDD2)" }}>Items In Goal ({selectedGoal.scopeCount})</h3>
                <button type="button" onClick={() => setShowAllGoalItems((v) => !v)} className="text-xs font-bold vltd-tap-y" style={{ color: "var(--theme-gold,#C8CDD2)" }}>{showAllGoalItems ? "Show less" : "View all"}</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {(showAllGoalItems ? selectedGoal.thumbnails : selectedGoal.thumbnails.slice(0, 5)).map((src, index) => (
                  <div key={`${src}-${index}`} className="flex h-16 w-16 items-center justify-center rounded-[6px] border border-[rgba(203,208,213,0.22)] bg-black/20">
                    <img src={src} alt="" className="max-h-14 max-w-14 object-contain" />
                  </div>
                ))}
                {!showAllGoalItems && selectedGoal.thumbnails.length > 5 && (
                  <div className="grid h-16 w-16 place-items-center rounded-[6px] border border-[rgba(203,208,213,0.22)] text-sm font-black" style={{ color: "var(--theme-gold,#C8CDD2)" }}>+{selectedGoal.thumbnails.length - 5}</div>
                )}
              </div>
            </section>

            <div className="mt-5 grid gap-3">
              <button type="button" onClick={() => addGoalToWishlist(selectedGoal)} disabled={selectedGoal.type !== "count" || selectedGoal.missing <= 0} className="rounded-[7px] px-4 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60" style={{ background: "linear-gradient(135deg,#8C9298,#C8CDD2)", color: "#0B0B0B" }}>
                {selectedGoal.type === "setup" ? "Set up the goal first" : selectedGoal.type === "value" ? "Wishlist is for item goals" : selectedGoal.missing > 0 ? "Add missing to Wishlist" : "Goal complete"}
              </button>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => shareGoal(selectedGoal)} className="rounded-[7px] border border-[rgba(203,208,213,0.22)] px-4 py-3 text-sm font-bold" style={{ color: "var(--theme-gold,#C8CDD2)" }}>Share goal</button>
                <button type="button" onClick={() => void handleDeleteGoal(selectedGoal)} className="rounded-[7px] border border-red-500/45 px-4 py-3 text-sm font-bold text-red-400">Delete goal</button>
              </div>
            </div>
          </aside>
        )}
      </div>

      {showAdd && (
        <AddGoalSheet
          onClose={() => setShowAdd(false)}
          onSave={async (fields, id) => {
            const result = await addGoal(fields, id);
            setGoals(loadGoals());
            refreshWaiting();
            if (result.ok && result.pending) showToast("Saved on this device. Sync pending: it will upload to your account when the connection is back.");
            else if (result.ok && result.typeOnDeviceOnly) showToast("Saved. How this goal is measured is kept on this device until your account can store it.");
            return result;
          }}
        />
      )}
      </main>
    </>
  );
}
