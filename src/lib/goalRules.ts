// Pure rules for collection goals (no storage, no network) so they can be tested on their own.

/** The database column is a 32-bit integer: a larger number is refused by the account, so it must be refused here, with words. */
export const GOAL_TARGET_MAX = 2147483647;

export type GoalTargetCheck = { ok: true; value: number } | { ok: false; message: string };

/** A valid target is a whole number from 1 to the database limit. Nothing is rounded or guessed. */
export function validateGoalTarget(raw: unknown): GoalTargetCheck {
  const text = String(raw ?? "").trim();
  if (!text) return { ok: false, message: "Enter how many items the complete set has." };
  // Thousands commas are fine ("1,000"); decimals, signs, exponents and letters are not.
  const digits = /^\d{1,3}(,\d{3})+$/.test(text) ? text.replace(/,/g, "") : text;
  if (!/^\d+$/.test(digits)) return { ok: false, message: "Enter a whole number, using digits only (no decimals, signs or letters)." };
  const value = Number(digits);
  if (!Number.isSafeInteger(value) || value > GOAL_TARGET_MAX) {
    return { ok: false, message: `Enter a number no larger than ${GOAL_TARGET_MAX.toLocaleString("en-US")}.` };
  }
  if (value < 1) return { ok: false, message: "The set must have at least 1 item." };
  return { ok: true, value };
}

type GoalLike = { id: string; createdAt: number };

/**
 * What the Goals page shows after reading the account:
 *  - the account's goals, except ones deleted here that the account has not confirmed deleting yet (they must not come back silently);
 *  - goals created or edited here that the account has not confirmed yet (the account's older copy never overwrites them).
 */
export function mergeCloudGoals<T extends GoalLike>(cloud: T[], local: T[], pendingIds: Set<string>, deletedIds: Set<string>): T[] {
  const byId = new Map<string, T>();
  for (const goal of cloud) if (!deletedIds.has(goal.id)) byId.set(goal.id, goal);
  for (const goal of local) {
    if (deletedIds.has(goal.id)) continue;
    if (pendingIds.has(goal.id)) byId.set(goal.id, goal);
  }
  return Array.from(byId.values()).sort((a, b) => b.createdAt - a.createdAt);
}
