import { mayAdoptLegacyKey } from "./legacyKeys";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { stillSignedInAs, storedSessionUserId } from "@/lib/sessionGuard";
import type { VaultItem } from "@/lib/vaultModel";
import { isNetworkFailure } from "@/lib/vaultCloud";
import { registerCloudSaveRetry, reportPending, reportSaved, reportSaving } from "@/lib/cloudSaveStatus";
import { GOAL_UNIT, mayAdoptDeviceWideGoals, mergeCloudGoals, readStoredKind, validateGoalTarget, type GoalKind, type GoalUnit } from "@/lib/goalRules";
import { activeItems as ownedItems, summarizeValues } from "@/lib/vaultStats";
import { currentLocalOwner } from "@/lib/localDataOwner";

export type { GoalKind, GoalUnit };

export type CollectionGoal = {
  id: string;
  name: string;
  /** The target in the goal's own unit: items for a "count" goal, whole US dollars for a "value" goal. */
  targetCount: number;
  /** How the goal is measured, chosen by the person. Absent on goals made before this existed: those are "not set up", never guessed. */
  goalType?: GoalKind;
  unit?: GoalUnit;
  universe?: string;
  subject?: string;
  notes?: string;
  createdAt: number;
};

export type GoalProgress = CollectionGoal & {
  /** The explicit kind, or null while the goal has not been set up (old goals): nothing is measured until the person chooses. */
  kind: GoalKind | null;
  needsSetup: boolean;
  /** Items owned (count goals) or whole dollars of value (value goals). */
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
      // Older builds kept one list for the whole device. It goes to this profile only when the device has recorded THIS signed-in
      // person as the owner of what it holds; before that is settled its owner is uncertain and it is left alone (see legacyDeviceWideGoalCount).
      if (legacy && mayAdoptLegacyKey(LS_BASE, key) && mayAdoptDeviceWideGoals(currentLocalOwner(), storedSessionUserId())) {
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

/** Goals an older version left in the device-wide list that this profile has NOT been given because their owner is uncertain. They are kept untouched. */
export function legacyDeviceWideGoalCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    const key = lsKey();
    if (key === LS_BASE || localStorage.getItem(key)) return 0;
    const legacy = localStorage.getItem(LS_BASE);
    if (!legacy) return 0;
    if (mayAdoptDeviceWideGoals(currentLocalOwner(), storedSessionUserId()) && mayAdoptLegacyKey(LS_BASE, key)) return 0;
    const parsed: unknown = JSON.parse(legacy);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

export function saveGoals(goals: CollectionGoal[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(lsKey(), JSON.stringify(goals));
}

// ── Account sync ─────────────────────────────────────────────────────
// Device first, account second, and NEVER "saved" before the account said so (audit GIN-066/068/070: a refused or lost request
// used to look saved, and the next load of the account's list silently undid it).
//   - a goal made or edited here is "waiting to upload" until the account confirms it (kept across reloads, retried automatically);
//   - a goal deleted here is hidden but remembered as "waiting to delete" until the account confirms, so a load can't bring it back;
//   - a request the account REFUSES (not just unreachable) is reported, and the goal is not kept.
const LS_PENDING = "vltd_collection_goals_pending_v1";
const LS_DELETED = "vltd_collection_goals_deleted_v1";
// Ids this device has seen in the account (confirmed uploads and every read): a goal on the device that is in this list but no longer in
// the account was deleted on another device.
const LS_SYNCED = "vltd_collection_goals_synced_v1";

function idSetKey(base: string, pid: string) {
  return `${base}:${pid}`;
}
function readIdSet(base: string, pid: string): Set<string> {
  if (typeof window === "undefined" || !pid) return new Set();
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(idSetKey(base, pid)) ?? "[]");
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}
function writeIdSet(base: string, pid: string, ids: Set<string>) {
  if (typeof window === "undefined" || !pid) return;
  try {
    localStorage.setItem(idSetKey(base, pid), JSON.stringify(Array.from(ids)));
  } catch {
    /* storage full or blocked: the goal itself is still saved */
  }
}
function addToSet(base: string, pid: string, id: string) {
  const ids = readIdSet(base, pid);
  ids.add(id);
  writeIdSet(base, pid, ids);
}
function removeFromSet(base: string, pid: string, id: string) {
  const ids = readIdSet(base, pid);
  if (ids.delete(id)) writeIdSet(base, pid, ids);
}

/** Goals of the active profile that the account has not confirmed yet (new, edited) and deletions it has not confirmed. */
export function pendingGoalCounts(): { saves: number; deletes: number } {
  const pid = activeProfileId();
  return { saves: readIdSet(LS_PENDING, pid).size, deletes: readIdSet(LS_DELETED, pid).size };
}

// The account's goal table gets goal_type / unit columns in a separate SQL step. Until it has them (or if it never does) the goal still saves
// without those two fields and the choice is kept on this device; the page says so. null = not tried yet.
let typeColumns: boolean | null = null;

function isMissingTypeColumn(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const text = String(error.message ?? "");
  return error.code === "PGRST204" || error.code === "42703" || (/goal_type|\bunit\b/.test(text) && /column|schema cache/i.test(text));
}

function goalRow(goal: CollectionGoal, pid: string, withType: boolean) {
  return {
    id: goal.id,
    profile_id: pid,
    name: goal.name,
    target_count: goal.targetCount,
    universe: goal.universe ?? null,
    subject: goal.subject ?? null,
    notes: goal.notes ?? null,
    created_at: new Date(goal.createdAt || Date.now()).toISOString(),
    ...(withType && goal.goalType ? { goal_type: goal.goalType, unit: GOAL_UNIT[goal.goalType] } : {}),
  };
}

type WriteOutcome = { state: "saved"; typeKept?: boolean } | { state: "unreachable" } | { state: "refused"; message: string };

function classify(error: { message?: string; status?: number } | null): WriteOutcome {
  if (!error) return { state: "saved" };
  const status = typeof error.status === "number" ? error.status : undefined;
  if (isNetworkFailure(error) || (status !== undefined && status >= 500)) return { state: "unreachable" };
  return { state: "refused", message: String(error.message ?? "The account refused this change.") };
}

async function pushGoalConfirmed(goal: CollectionGoal, pid: string): Promise<WriteOutcome> {
  try {
    if (!pid) return { state: "unreachable" };
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return { state: "unreachable" };
    const wantsType = Boolean(goal.goalType);
    let withType = wantsType && typeColumns !== false;
    let { data, error } = await supabase.from("collection_goals").upsert(goalRow(goal, pid, withType), { onConflict: "id" }).select("id");
    if (error && withType && isMissingTypeColumn(error)) {
      typeColumns = false;
      withType = false;
      ({ data, error } = await supabase.from("collection_goals").upsert(goalRow(goal, pid, false), { onConflict: "id" }).select("id"));
    } else if (!error && withType) {
      typeColumns = true;
    }
    if (error) return classify(error);
    if (!data || data.length === 0) return { state: "refused", message: "The account did not accept this goal." };
    // typeKept: the account holds how the goal is measured (or there is nothing to hold). false = it is on this device only for now.
    return { state: "saved", typeKept: !wantsType || withType };
  } catch (error) {
    return classify(error as { message?: string });
  }
}

async function deleteGoalConfirmed(id: string, pid: string): Promise<WriteOutcome> {
  try {
    if (!pid) return { state: "unreachable" };
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return { state: "unreachable" };
    const { data, error } = await supabase.from("collection_goals").delete().eq("id", id).eq("profile_id", pid).select("id");
    if (error) return classify(error);
    if (data && data.length > 0) return { state: "saved" };
    // Nothing was deleted: either it is already gone, or the account would not let this person delete it. Read it back.
    const check = await supabase.from("collection_goals").select("id").eq("id", id).eq("profile_id", pid);
    if (check.error) return classify(check.error);
    return check.data && check.data.length === 0 ? { state: "saved" } : { state: "refused", message: "The account would not delete this goal." };
  } catch (error) {
    return classify(error as { message?: string });
  }
}

function reportOutcome(pid: string) {
  const counts = { saves: readIdSet(LS_PENDING, pid).size, deletes: readIdSet(LS_DELETED, pid).size };
  if (counts.saves + counts.deletes > 0) reportPending("goals");
  else reportSaved("goals");
}

/** typeOnDeviceOnly: the goal is saved, but how it is measured could not be stored in the account yet (kept on this device, uploaded when the account can hold it). */
export type GoalWriteResult = { ok: true; pending: boolean; typeOnDeviceOnly?: boolean } | { ok: false; error: string };

/** Try again for everything of the active profile that the account has not confirmed (retry timer, page load, "Retry now"). */
export async function retryPendingGoals(): Promise<void> {
  const pid = activeProfileId();
  if (!pid) return;
  const pending = readIdSet(LS_PENDING, pid);
  const deleted = readIdSet(LS_DELETED, pid);
  if (pending.size + deleted.size === 0) return;
  reportSaving("goals");
  const local = loadGoals();
  for (const id of Array.from(deleted)) {
    const r = await deleteGoalConfirmed(id, pid);
    // saved: done. refused: the account keeps the goal, so it comes back on the next load (the person was told when they deleted it).
    if (r.state !== "unreachable") removeFromSet(LS_DELETED, pid, id);
    if (r.state === "saved") removeFromSet(LS_SYNCED, pid, id);
  }
  for (const id of Array.from(pending)) {
    const goal = local.find((g) => g.id === id);
    if (!goal) {
      removeFromSet(LS_PENDING, pid, id);
      continue;
    }
    const r = await pushGoalConfirmed(goal, pid);
    if (r.state !== "unreachable") removeFromSet(LS_PENDING, pid, id);
    if (r.state === "saved") addToSet(LS_SYNCED, pid, id);
  }
  reportOutcome(pid);
}

let retryRegistered = false;
function ensureRetryRegistered() {
  if (retryRegistered || typeof window === "undefined") return;
  retryRegistered = true;
  registerCloudSaveRetry(() => retryPendingGoals());
}

export async function syncGoalsFromSupabase(): Promise<CollectionGoal[]> {
  return (await syncGoalsFromSupabaseChecked()).goals;
}

/** Same pull, but says whether the account really answered ("no goals" and "could not reach the account" are different things). */
export async function syncGoalsFromSupabaseChecked(): Promise<{ goals: CollectionGoal[]; ok: boolean }> {
  if (typeof window === "undefined") return { goals: [], ok: false };
  ensureRetryRegistered();
  // First finish what this device still owes the account, so the list read below already includes it.
  if (activeProfileId()) await retryPendingGoals().catch(() => undefined);
  const local = loadGoals();
  try {
    const pid = activeProfileId();
    if (!pid) return { goals: local, ok: true };
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return { goals: local, ok: false };
    const startedAs = storedSessionUserId();
    const baseColumns = "id,name,target_count,universe,subject,notes,created_at";
    type Pulled = { data: Record<string, unknown>[] | null; error: { message?: string; code?: string } | null };
    let pulled = (await supabase.from("collection_goals").select(typeColumns === false ? baseColumns : baseColumns + ",goal_type,unit").eq("profile_id", pid)) as unknown as Pulled;
    if (pulled.error && typeColumns !== false && isMissingTypeColumn(pulled.error)) {
      typeColumns = false;
      pulled = (await supabase.from("collection_goals").select(baseColumns).eq("profile_id", pid)) as unknown as Pulled;
    } else if (!pulled.error && typeColumns === null) {
      typeColumns = true;
    }
    const { data, error } = pulled;
    if (error || !data) return { goals: local, ok: false };
    // The answer is for the person and profile that asked. If either changed while it was in flight, drop it: saving it would
    // file one profile's goals under another's, and pushing the local copy would upload them to the wrong profile.
    if (!stillSignedInAs(startedAs) || activeProfileId() !== pid) return { goals: local, ok: false };
    const needTypeUpload: string[] = [];
    const fromCloud: CollectionGoal[] = data.map((r: Record<string, unknown>) => {
      const id = String(r.id);
      let goalType = readStoredKind(r.goal_type, r.unit);
      // The account has no stored kind for this goal. If this device holds the person's choice, keep it (and send it up when the account can hold it).
      if (!goalType) {
        const mine = local.find((g) => g.id === id)?.goalType;
        if (mine) { goalType = mine; if (typeColumns !== false) needTypeUpload.push(id); }
      }
      return {
        id,
        name: String(r.name ?? ""),
        targetCount: Number(r.target_count ?? 1),
        universe: (r.universe as string) ?? undefined,
        subject: (r.subject as string) ?? undefined,
        notes: (r.notes as string) ?? undefined,
        createdAt: Date.parse(String(r.created_at)) || Date.now(),
        ...(goalType ? { goalType, unit: GOAL_UNIT[goalType] } : {}),
      };
    });
    if (needTypeUpload.length > 0) {
      const queued = readIdSet(LS_PENDING, pid);
      for (const id of needTypeUpload) queued.add(id);
      writeIdSet(LS_PENDING, pid, queued);
    }
    const merged = mergeCloudGoals(fromCloud, local, readIdSet(LS_PENDING, pid), readIdSet(LS_DELETED, pid), readIdSet(LS_SYNCED, pid));
    // What the account holds is now known to this device.
    const synced = readIdSet(LS_SYNCED, pid);
    for (const g of fromCloud) synced.add(g.id);
    for (const id of merged.deletedElsewhere) synced.delete(id);
    writeIdSet(LS_SYNCED, pid, synced);
    saveGoals(merged.goals);
    // Goals that exist only on this device are owed to the account: queue them and upload (they stay listed meanwhile).
    if (merged.deviceOnly.length > 0) {
      const pending = readIdSet(LS_PENDING, pid);
      for (const id of merged.deviceOnly) pending.add(id);
      writeIdSet(LS_PENDING, pid, pending);
      await retryPendingGoals().catch(() => undefined);
      return { goals: loadGoals(), ok: true };
    }
    return { goals: merged.goals, ok: true };
  } catch {
    return { goals: local, ok: false };
  }
}

/**
 * Create a goal. Stored on this device first, then confirmed by the account:
 *  ok, pending=false  the account has it
 *  ok, pending=true   saved on this device, the account was unreachable: it will upload (and the page says so)
 *  not ok             the target is invalid or the account refused it: nothing was kept, the form stays as typed
 * `id` makes a retry or a repeated click write the SAME goal, never a second one.
 */
export async function addGoal(fields: Omit<CollectionGoal, "id" | "createdAt">, id?: string): Promise<GoalWriteResult> {
  ensureRetryRegistered();
  const target = validateGoalTarget(fields.targetCount, fields.goalType ?? "count");
  if (!target.ok) return { ok: false, error: target.message };
  const pid = activeProfileId();
  const goalId = id || `goal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const existing = loadGoals().find((g) => g.id === goalId);
  const goal: CollectionGoal = existing ?? { id: goalId, createdAt: Date.now(), ...fields, targetCount: target.value, ...(fields.goalType ? { unit: GOAL_UNIT[fields.goalType] } : {}) };
  if (!existing) saveGoals([...loadGoals(), goal]);
  addToSet(LS_PENDING, pid, goal.id);
  reportSaving("goals");
  const r = await pushGoalConfirmed(goal, pid);
  if (r.state === "saved") {
    removeFromSet(LS_PENDING, pid, goal.id);
    addToSet(LS_SYNCED, pid, goal.id);
    reportOutcome(pid);
    return { ok: true, pending: false, ...(r.typeKept === false ? { typeOnDeviceOnly: true } : {}) };
  }
  if (r.state === "unreachable") {
    reportPending("goals");
    return { ok: true, pending: true };
  }
  // Refused: do not keep a goal the account will never take.
  removeFromSet(LS_PENDING, pid, goal.id);
  saveGoals(loadGoals().filter((g) => g.id !== goal.id));
  reportOutcome(pid);
  return { ok: false, error: `The goal was not saved: ${r.message}` };
}

export async function updateGoal(id: string, patch: Partial<Omit<CollectionGoal, "id" | "createdAt">>): Promise<GoalWriteResult> {
  ensureRetryRegistered();
  const pid = activeProfileId();
  const before = loadGoals();
  const previous = before.find((g) => g.id === id);
  if (!previous) return { ok: false, error: "That goal no longer exists." };
  if (patch.targetCount !== undefined) {
    const target = validateGoalTarget(patch.targetCount, patch.goalType ?? previous.goalType ?? "count");
    if (!target.ok) return { ok: false, error: target.message };
    patch = { ...patch, targetCount: target.value };
  }
  if (patch.goalType) patch = { ...patch, unit: GOAL_UNIT[patch.goalType] };
  const updated = { ...previous, ...patch };
  saveGoals(before.map((g) => (g.id === id ? updated : g)));
  addToSet(LS_PENDING, pid, id);
  reportSaving("goals");
  const r = await pushGoalConfirmed(updated, pid);
  if (r.state === "saved") {
    removeFromSet(LS_PENDING, pid, id);
    addToSet(LS_SYNCED, pid, id);
    reportOutcome(pid);
    return { ok: true, pending: false, ...(r.typeKept === false ? { typeOnDeviceOnly: true } : {}) };
  }
  if (r.state === "unreachable") {
    reportPending("goals");
    return { ok: true, pending: true };
  }
  removeFromSet(LS_PENDING, pid, id);
  saveGoals(loadGoals().map((g) => (g.id === id ? previous : g)));
  reportOutcome(pid);
  return { ok: false, error: `The change was not saved: ${r.message}` };
}

/**
 * Delete a goal. It leaves the list at once but is remembered as "waiting to delete" until the account confirms, so a reload
 * cannot bring it back unannounced. If the account refuses, the goal is put back and the person is told.
 */
export async function deleteGoal(id: string): Promise<GoalWriteResult> {
  ensureRetryRegistered();
  const pid = activeProfileId();
  const all = loadGoals();
  const goal = all.find((g) => g.id === id);
  if (!goal) return { ok: true, pending: false };
  addToSet(LS_DELETED, pid, id);
  removeFromSet(LS_PENDING, pid, id);
  saveGoals(all.filter((g) => g.id !== id));
  reportSaving("goals");
  const r = await deleteGoalConfirmed(id, pid);
  if (r.state === "saved") {
    removeFromSet(LS_DELETED, pid, id);
    removeFromSet(LS_SYNCED, pid, id);
    reportOutcome(pid);
    return { ok: true, pending: false };
  }
  if (r.state === "unreachable") {
    reportPending("goals");
    return { ok: true, pending: true };
  }
  removeFromSet(LS_DELETED, pid, id);
  saveGoals([...loadGoals(), goal]);
  reportOutcome(pid);
  return { ok: false, error: `The goal was not deleted: ${r.message}` };
}

function activeItems(items: VaultItem[]) {
  return items.filter((item) => item.status !== "SOLD" && item.status !== "WISHLIST");
}

/** The items a goal covers: its subject, else its category, else everything owned. Scope only: never decides how the goal is measured. */
function inScope(goal: CollectionGoal, items: VaultItem[]): VaultItem[] {
  if (goal.subject?.trim()) {
    const key = goal.subject.trim().toLowerCase();
    return items.filter((item) => (item.subject ?? "").toLowerCase() === key);
  }
  if (goal.universe) return items.filter((item) => item.universe === goal.universe);
  return items;
}

export function computeGoalProgress(goal: CollectionGoal, vaultItems: VaultItem[]): GoalProgress {
  const kind = readStoredKind(goal.goalType, goal.unit) ?? null;
  const targetCount = Math.max(1, goal.targetCount);

  // Not set up (a goal made before goals had an explicit type): the person has not said whether it counts items or measures money, and the name
  // is not read to guess. No progress is shown until they choose.
  if (!kind) {
    return { ...goal, targetCount, kind: null, needsSetup: true, ownedCount: 0, pct: 0, missing: 0, isComplete: false, isAlmostThere: false };
  }

  let ownedCount: number;
  if (kind === "value") {
    // What the owned items in scope are worth, by the one value rule the Vault and Insights use (un-priced items count at what was paid).
    ownedCount = Math.round(summarizeValues(inScope(goal, ownedItems(vaultItems))).totalValue);
  } else {
    ownedCount = inScope(goal, activeItems(vaultItems)).length;
  }

  const pct = Math.min(100, Math.round((ownedCount / targetCount) * 100));
  const missing = Math.max(0, targetCount - ownedCount);

  return {
    ...goal,
    targetCount,
    kind,
    needsSetup: false,
    ownedCount,
    pct,
    missing,
    isComplete: ownedCount >= targetCount,
    isAlmostThere: pct >= 90 && ownedCount < targetCount,
  };
}

/** "9 of 12 items" / "$1,200 of $2,000"; a goal that is not set up says so instead of showing a figure. */
export function describeGoalProgress(goal: GoalProgress): string {
  if (goal.needsSetup) return "Choose how this goal is measured";
  if (goal.kind === "value") {
    const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
    return money(goal.ownedCount) + " of " + money(goal.targetCount);
  }
  return goal.ownedCount.toLocaleString("en-US") + " of " + goal.targetCount.toLocaleString("en-US") + " items";
}

export function computeAllGoalProgress(
  goals: CollectionGoal[],
  vaultItems: VaultItem[]
): GoalProgress[] {
  return goals
    .map((goal) => computeGoalProgress(goal, vaultItems))
    .sort((a, b) => b.pct - a.pct);
}
