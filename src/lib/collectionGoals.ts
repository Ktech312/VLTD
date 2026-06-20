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

const STORAGE_KEY = "vltd_collection_goals_v1";

export function loadGoals(): CollectionGoal[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CollectionGoal[]) : [];
  } catch {
    return [];
  }
}

export function saveGoals(goals: CollectionGoal[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
}

export function addGoal(fields: Omit<CollectionGoal, "id" | "createdAt">): CollectionGoal {
  const goal: CollectionGoal = {
    id: `goal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    ...fields,
  };
  saveGoals([...loadGoals(), goal]);
  return goal;
}

export function updateGoal(
  id: string,
  patch: Partial<Omit<CollectionGoal, "id" | "createdAt">>
) {
  saveGoals(loadGoals().map((goal) => (goal.id === id ? { ...goal, ...patch } : goal)));
}

export function deleteGoal(id: string) {
  saveGoals(loadGoals().filter((goal) => goal.id !== id));
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
