import type { SupabaseClient } from "@supabase/supabase-js";
import type { EventRow } from "@/lib/events/eventPipeline";

// A small memory for the scheduled event refreshes, so a retry does not pay twice for work that already succeeded.
//
// The refresh does paid work in steps: searches (Google Events via SerpApi), then one AI check of which results are real collectibles events, then the save.
// When the AI step is refused (as on 2026-10-23 and 24, when the Anthropic credit ran out) the searches had already succeeded, but their results lived only in
// the run's memory and were lost, so every retry paid for the same searches again. This store keeps:
//  - event_refresh_candidates: every event found and parsed, with the AI's verdict (pending = not yet judged, approved, rejected) and whether it was saved;
//  - event_refresh_steps: the paid steps that already succeeded today (a search, the snippets for a major show, the AI's answer for a major show).
// A later run reuses them: it does not repeat a search that succeeded the same day, asks the AI only about events it has not yet judged, and saves what was
// approved but not yet saved.
//
// The tables are created by SQL the owner runs (repair-batch-18/sql/8-event-refresh-store.sql). Until then the store reports itself unavailable and every
// call here does nothing, so the jobs behave exactly as they did before it existed.

export type StoredCandidate = {
  slug: string;
  category: string;
  source: string;
  row: EventRow;
  description: string | null;
  verdict: "pending" | "approved" | "rejected";
  saved_at: string | null;
};

export type NewCandidate = { slug: string; category: string; source: string; row: EventRow; description: string | null };

const CANDIDATES = "event_refresh_candidates";
const STEPS = "event_refresh_steps";
const KEEP_CANDIDATES_DAYS = 30;
const KEEP_STEPS_DAYS = 3;

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "PGRST205" || error.code === "42P01" || /could not find the table|does not exist|schema cache/i.test(error.message ?? "");
}

export class RefreshStore {
  available = false;
  /** Why the store is not in use (not set up yet, or an unexpected error), for the run's log. */
  note: string | null = null;
  private steps = new Map<string, unknown>();

  constructor(private svc: SupabaseClient, readonly day: string) {}

  /** Checks the tables exist and loads today's finished steps. Never throws. */
  async open(): Promise<this> {
    try {
      const { data, error } = await this.svc.from(STEPS).select("step_key, payload").like("step_key", `%|${this.day}|%`).limit(5000);
      if (error) {
        this.note = isMissingTable(error) ? "not set up (SQL file 8 has not been run)" : `unavailable: ${error.message}`.slice(0, 200);
        return this;
      }
      for (const r of (data ?? []) as Array<{ step_key: string; payload: unknown }>) this.steps.set(r.step_key, r.payload);
      this.available = true;
    } catch (err) {
      this.note = `unavailable: ${String(err)}`.slice(0, 200);
    }
    return this;
  }

  stepKey(type: string, ...parts: string[]): string {
    return [type, this.day, ...parts].join("|");
  }

  /** The stored result of a step that already succeeded today, or undefined. */
  done<T = unknown>(key: string): T | undefined {
    return this.steps.get(key) as T | undefined;
  }

  async record(key: string, payload: unknown): Promise<void> {
    if (!this.available) return;
    this.steps.set(key, payload);
    const { error } = await this.svc.from(STEPS).upsert({ step_key: key, payload }, { onConflict: "step_key" });
    if (error) this.note = `could not record a step: ${error.message}`.slice(0, 200);
  }

  /** Keeps what was found: new events are added as pending; ones already known are only marked as seen again (a verdict is never reset). */
  async addCandidates(items: NewCandidate[]): Promise<void> {
    if (!this.available || !items.length) return;
    const unique = [...new Map(items.map((i) => [i.slug, i])).values()];
    const { data, error } = await this.svc.from(CANDIDATES).select("slug").in("slug", unique.map((i) => i.slug));
    if (error) {
      this.note = `could not read candidates: ${error.message}`.slice(0, 200);
      return;
    }
    const known = new Set(((data ?? []) as Array<{ slug: string }>).map((r) => r.slug));
    const fresh = unique.filter((i) => !known.has(i.slug));
    for (let i = 0; i < fresh.length; i += 50) {
      const chunk = fresh.slice(i, i + 50).map((c) => ({ slug: c.slug, category: c.category, source: c.source, row_data: c.row, description: c.description, first_seen_day: this.day }));
      const { error: insertError } = await this.svc.from(CANDIDATES).insert(chunk);
      if (insertError) this.note = `could not keep candidates: ${insertError.message}`.slice(0, 200);
    }
    if (known.size) await this.svc.from(CANDIDATES).update({ last_seen_at: new Date().toISOString() }).in("slug", [...known]);
  }

  /** Events found but not yet judged by the AI check (oldest first, so nothing waits forever). */
  async pending(limit = 120): Promise<StoredCandidate[]> {
    if (!this.available) return [];
    const { data } = await this.svc
      .from(CANDIDATES)
      .select("slug, category, source, row_data, description, verdict, saved_at")
      .eq("verdict", "pending")
      .order("first_seen_day", { ascending: true })
      .limit(limit);
    return this.mapRows(data);
  }

  /** Events the AI check already approved that have not been saved yet (a save failed or the run ended first): saved without asking the AI again. */
  async approvedUnsaved(): Promise<StoredCandidate[]> {
    if (!this.available) return [];
    const { data } = await this.svc
      .from(CANDIDATES)
      .select("slug, category, source, row_data, description, verdict, saved_at")
      .eq("verdict", "approved")
      .is("saved_at", null)
      .limit(500);
    return this.mapRows(data);
  }

  private mapRows(data: unknown): StoredCandidate[] {
    return ((data ?? []) as Array<{ slug: string; category: string; source: string; row_data: EventRow; description: string | null; verdict: StoredCandidate["verdict"]; saved_at: string | null }>).map(
      (r) => ({ slug: r.slug, category: r.category, source: r.source, row: r.row_data, description: r.description, verdict: r.verdict, saved_at: r.saved_at }),
    );
  }

  /** Writes down the AI's verdicts. Only events the AI actually answered about are marked; anything it skipped stays pending. */
  async judge(approved: string[], rejected: string[]): Promise<void> {
    if (!this.available) return;
    const at = new Date().toISOString();
    if (approved.length) await this.svc.from(CANDIDATES).update({ verdict: "approved", judged_at: at }).in("slug", approved);
    if (rejected.length) await this.svc.from(CANDIDATES).update({ verdict: "rejected", judged_at: at }).in("slug", rejected);
  }

  async markSaved(slugs: string[]): Promise<void> {
    if (!this.available || !slugs.length) return;
    await this.svc.from(CANDIDATES).update({ saved_at: new Date().toISOString() }).in("slug", slugs);
  }

  /** Housekeeping: old candidates and finished steps are removed. */
  async purge(): Promise<void> {
    if (!this.available) return;
    const day = 86_400_000;
    await this.svc.from(CANDIDATES).delete().lt("last_seen_at", new Date(Date.now() - KEEP_CANDIDATES_DAYS * day).toISOString());
    await this.svc.from(STEPS).delete().lt("created_at", new Date(Date.now() - KEEP_STEPS_DAYS * day).toISOString());
  }
}

export async function openRefreshStore(svc: SupabaseClient, day: string): Promise<RefreshStore> {
  return new RefreshStore(svc, day).open();
}
