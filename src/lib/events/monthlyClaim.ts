import type { SupabaseClient } from "@supabase/supabase-js";

// The once-a-month guard for the monthly Events refresh. Before any paid request, the run writes one marker row for the calendar month (UTC) into vltd_migration_flags,
// an existing table (name text primary key, done_at timestamptz; service role only). A primary key admits one row per name, so of any number of invocations in the same
// month, whether sequential, repeated by hand or at the same instant, exactly ONE can claim it and do the work; the others find it taken and do nothing.
// If the marker cannot be written for any reason other than "already taken", the run does NOT start (it cannot promise to run only once).

const TABLE = "vltd_migration_flags";

export const monthClaimName = (now: Date): string => `events-monthly-refresh:${now.toISOString().slice(0, 7)}`;

export type ClaimResult = { status: "claimed" } | { status: "already" } | { status: "error"; message: string };

export async function claimMonth(svc: SupabaseClient, name: string): Promise<ClaimResult> {
  try {
    const { error } = await svc.from(TABLE).insert({ name });
    if (!error) return { status: "claimed" };
    if (error.code === "23505" || /duplicate key/i.test(error.message ?? "")) return { status: "already" };
    return { status: "error", message: `${error.code ?? ""} ${error.message}`.trim().slice(0, 200) };
  } catch (err) {
    return { status: "error", message: String(err).slice(0, 200) };
  }
}

/** Gives the month back. Only used when the run stopped BEFORE any search or paid AI request for the work was made, so no monthly work was done. */
export async function releaseMonth(svc: SupabaseClient, name: string): Promise<void> {
  try {
    await svc.from(TABLE).delete().eq("name", name);
  } catch {
    /* a marker that could not be removed only means the owner must clear it by hand */
  }
}
