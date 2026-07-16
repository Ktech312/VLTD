import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { VaultItem } from "@/lib/vaultModel";

export type CollectionGoal = {
  id: string;
  name: string;
  targetCount: number;
  universe?: string;
  subject?: string;
  notes?: string;
  createdAt: number;
};

export type GoalProgress = CollectionGoal & {
  ownedCount: number;
  pct: number;
  missing: number;
  isComplete: boolean;
  isAlmostThere: boolean;
};

const LS_BASE = "vltd_collection_goals_v1";
const ACTIVE_PROFILE_KEY = "vltd_active_profile_id_v1";

function activeProfileId(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(ACTIVE_PROFILE_KEY) ?? "";
  } catch {
    return "";
  }
}

function lsKey(): string {
  const pid = activeProfileId();
  return pid ? `${LS_BASE}:${pid}` : LS_BASE;
}

export function loadGoals(): CollectionGoal[] {
  if (typeof window === "undefined") return [];
  try {
    const key = lsKey();
    let raw = localStorage.getItem(key);
    if (!raw && key !== LS_BASE) {
      const legacy = localStorage.getItem(LS_BASE);
      if (legacy) {
        localStorage.setItem(key, legacy);
        raw = legacy;
      }
    }
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CollectionGoal[]) : [];
  } catch {
    return [];
  }
}

export function saveGoals(goals: CollectionGoal[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(lsKey(), JSON.stringify(goals));
}

// ── Supabase sync (best-effort; local cache always works) ───────────
function goalRow(goal: CollectionGoal, pid: string) {
  return {
    id: goal.id,
    profile_id: pid,
    name: goal.name,
    target_count: goal.targetCount,
    universe: goal.universe ?? null,
    subject: goal.subject ?? null,
    notes: goal.notes ?? null,
    created_at: new Date(goal.createdAt || Date.now()).toISOString(),
  };
}

async function pushGoal(goal: CollectionGoal) {
  try {
    const pid = activeProfileId();
    if (!pid) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    await supabase.from("collection_goals").upsert(goalRow(goal, pid), { onConflict: "id" });
  } catch {
    /* table may not exist yet — local still holds it */
  }
}

async function deleteGoalRow(id: string) {
  try {
    const pid = activeProfileId();
    if (!pid) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    await supabase.from("collection_goals").delete().eq("id", id).eq("profile_id", pid);
  } catch {
    /* ignore */
  }
}

export async function syncGoalsFromSupabase(): Promise<CollectionGoal[]> {
  if (typeof window === "undefined") return [];
  const local = loadGoals();
  try {
    const pid = activeProfileId();
    if (!pid) return local;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return local;
    const { data, error } = await supabase
      .from("collection_goals")
      .select("id,name,target_count,universe,subject,notes,created_at")
      .eq("profile_id", pid);
    if (error || !data) return local;
    if (data.length === 0) {
      for (const g of local) void pushGoal(g);
      return local;
    }
    const goals: CollectionGoal[] = data.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      name: String(r.name ?? ""),
      targetCount: Number(r.target_count ?? 1),
      universe: (r.universe as string) ?? undefined,
      subject: (r.subject as string) ?? undefined,
      notes: (r.notes as string) ?? undefined,
      createdAt: Date.parse(String(r.created_at)) || Date.now(),
    }));
    goals.sort((a, b) => b.createdAt - a.createdAt);
    saveGoals(goals);
    return goals;
  } catch {
    return local;
  }
}

export function addGoal(fields: Omit<CollectionGoal, "id" | "createdAt">): CollectionGoal {
  const goal: CollectionGoal = {
    id: `goal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    ...fields,
  };
  saveGoals([...loadGoals(), goal]);
  void pushGoal(goal);
  return goal;
}

export function updateGoal(
  id: string,
  patch: Partial<Omit<CollectionGoal, "id" | "createdAt">>
) {
  const next = loadGoals().map((goal) => (goal.id === id ? { ...goal, ...patch } : goal));
  saveGoals(next);
  const updated = next.find((g) => g.id === id);
  if (updated) void pushGoal(updated);
}

export function deleteGoal(id: string) {
  saveGoals(loadGoals().filter((goal) => goal.id !== id));
  void deleteGoalRow(id);
}

function activeItems(items: VaultItem[]) {
  return items.filter((item) => item.status !== "SOLD" && item.status !== "WISHLIST");
}

export function computeGoalProgress(goal: CollectionGoal, vaultItems: VaultItem[]): GoalProgress {
  const active = activeItems(vaultItems);
  let ownedCount: number;

  if (goal.subject?.trim()) {
    const key = goal.subject.trim().toLowerCase();
    ownedCount = active.filter((item) => (item.subject ?? "").toLowerCase() === key).length;
  } else if (goal.universe) {
    ownedCount = active.filter((item) => item.universe === goal.universe).length;
  } else {
    ownedCount = active.length;
  }

  const targetCount = Math.max(1, goal.targetCount);
  const pct = Math.min(100, Math.round((ownedCount / targetCount) * 100));
  const missing = Math.max(0, targetCount - ownedCount);

  return {
    ...goal,
    targetCount,
    ownedCount,
    pct,
    missing,
    isComplete: ownedCount >= targetCount,
    isAlmostThere: pct >= 90 && ownedCount < targetCount,
  };
}

export function computeAllGoalProgress(
  goals: CollectionGoal[],
  vaultItems: VaultItem[]
): GoalProgress[] {
  return goals
    .map((goal) => computeGoalProgress(goal, vaultItems))
    .sort((a, b) => b.pct - a.pct);
}
