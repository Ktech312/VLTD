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

export type GoalMerge<T> = {
  goals: T[];
  /** Goals that exist only on this device (made before goals were tracked as "waiting"): kept, and owed to the account. */
  deviceOnly: string[];
  /** Goals this device had confirmed in the account earlier that the account no longer holds: deleted elsewhere, so not brought back. */
  deletedElsewhere: string[];
};

/**
 * What the Goals page shows after reading the account. BOTH sets are kept:
 *  - the account's goals, except ones deleted here that the account has not confirmed deleting yet (they must not come back silently);
 *  - goals created or edited here that the account has not confirmed yet (the account's older copy never overwrites them);
 *  - goals that exist only on this device under this profile (ownership is the profile the list is stored under): kept and uploaded,
 *    never silently dropped because the account already holds other goals;
 *  - EXCEPT a goal this device itself saw in the account before (`syncedIds`) and the account no longer holds: another device deleted it.
 *    That rule is only trusted when the account answered with goals; an empty answer may be a lapsed session, so nothing is dropped then.
 * Matching is by goal id, so a retry or a repeated read never makes a second copy.
 */
export function mergeCloudGoals<T extends GoalLike>(cloud: T[], local: T[], pendingIds: Set<string>, deletedIds: Set<string>, syncedIds: Set<string> = new Set()): GoalMerge<T> {
  const byId = new Map<string, T>();
  const deviceOnly: string[] = [];
  const deletedElsewhere: string[] = [];
  for (const goal of cloud) if (!deletedIds.has(goal.id)) byId.set(goal.id, goal);
  const trustSynced = cloud.length > 0;
  for (const goal of local) {
    if (deletedIds.has(goal.id)) continue;
    if (pendingIds.has(goal.id)) { byId.set(goal.id, goal); continue; }
    if (byId.has(goal.id)) continue; // the account has it
    if (cloud.some((c) => c.id === goal.id)) continue;
    if (trustSynced && syncedIds.has(goal.id)) { deletedElsewhere.push(goal.id); continue; }
    byId.set(goal.id, goal);
    deviceOnly.push(goal.id);
  }
  return { goals: Array.from(byId.values()).sort((a, b) => b.createdAt - a.createdAt), deviceOnly, deletedElsewhere };
}

/**
 * Whether a device-wide list from an older version (stored under no profile) may be given to this profile. Only when the device
 * has recorded THIS signed-in person as the owner of what it holds. Otherwise its owner is uncertain: it is kept where it is,
 * never adopted, never uploaded.
 */
export function mayAdoptDeviceWideGoals(recordedOwner: string | null, signedInUser: string | null): boolean {
  return !!recordedOwner && !!signedInUser && recordedOwner === signedInUser;
}
