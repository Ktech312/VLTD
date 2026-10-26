"use client";

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { getStoredActiveProfileId } from "@/lib/auth";

// How every AI scan is sent (item photo, certificate). The SERVER now owns the allowance: it checks the sign-in and the profile, reserves one scan from the profile's
// monthly allowance BEFORE calling the AI provider, and gives it back if the provider fails (lib/server/scanGuard.ts). The browser therefore never charges a scan itself
// any more: it only reads the new numbers from the answer. Charging here as well would take two scans for one.

export type ScanRefusalCode =
  | "signin"
  | "owner_only"
  | "not_member"
  | "profile_required"
  | "request_id_required"
  | "invalid_request"
  | "limit"
  | "duplicate"
  | "invalid_image"
  | "too_large"
  | "unsupported_type"
  | "unavailable"
  | "not_configured"
  | "busy"
  | "provider_unreachable"
  | "provider_failed"
  | "unreadable_answer";

export type ScanAllowance = { remaining: number; limit: number; used: number };

/** A scan that was refused or failed, with the plain sentence to show the person. `limit`, `signin`, `owner_only` and `not_member` mean "stop trying the rest of this batch". */
export class ScanRefusedError extends Error {
  code: ScanRefusalCode;
  allowance?: ScanAllowance;
  constructor(code: ScanRefusalCode, message: string, allowance?: ScanAllowance) {
    super(message);
    this.name = "ScanRefusedError";
    this.code = code;
    this.allowance = allowance;
  }
}

/** True when nothing more in a batch should be sent: the allowance is spent, or the person is not signed in / not allowed. */
export const stopsTheBatch = (err: unknown): err is ScanRefusedError => err instanceof ScanRefusedError && (err.code === "limit" || err.code === "signin" || err.code === "owner_only" || err.code === "not_member" || err.code === "profile_required");

// The same photo sent twice while the first is still on its way (a double press) is ONE request: the second press gets the first one's answer.
const inFlight = new Map<string, Promise<unknown>>();

function newRequestId(): string {
  const c = typeof crypto !== "undefined" ? crypto : undefined;
  if (c && "randomUUID" in c) return c.randomUUID();
  const b = new Uint8Array(16);
  (c ?? { getRandomValues: (a: Uint8Array) => a.map(() => Math.floor(Math.random() * 256)) }).getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export async function postScan<T>(path: "/api/ai/analyze-item" | "/api/ai/analyze-coa", form: FormData): Promise<{ data: T; allowance?: ScanAllowance }> {
  const image = form.get("image");
  const profileId = String(form.get("profileId") ?? "") || getStoredActiveProfileId() || "";
  const key = `${path}|${profileId}|${image instanceof File ? `${image.name}|${image.size}|${image.lastModified}` : "no-image"}`;
  const running = inFlight.get(key);
  if (running) return running as Promise<{ data: T; allowance?: ScanAllowance }>;
  const work = send<T>(path, form, profileId).finally(() => inFlight.delete(key));
  inFlight.set(key, work);
  return work;
}

async function send<T>(path: string, form: FormData, profileId: string): Promise<{ data: T; allowance?: ScanAllowance }> {
  const supabase = getSupabaseBrowserClient();
  const { data: sessionData } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
  const token = sessionData.session?.access_token;
  if (!token) throw new ScanRefusedError("signin", "Sign in to use AI scans.");
  if (!profileId) throw new ScanRefusedError("profile_required", "Choose which profile this scan is for and try again.");
  form.set("profileId", profileId);
  form.set("requestId", newRequestId());

  let response: Response;
  try {
    response = await fetch(path, { method: "POST", body: form, headers: { Authorization: `Bearer ${token}` } });
  } catch {
    throw new ScanRefusedError("unavailable", "Could not reach the scan service. Check your connection and try again.");
  }
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown> & { error?: string; code?: ScanRefusalCode; allowance?: ScanAllowance; remaining?: number; limit?: number; used?: number };
  const allowance = payload.allowance ?? (typeof payload.remaining === "number" && typeof payload.limit === "number" ? { remaining: payload.remaining, limit: payload.limit, used: Number(payload.used ?? 0) } : undefined);
  if (!response.ok) {
    throw new ScanRefusedError(payload.code ?? "unavailable", String(payload.error ?? "The scan failed."), allowance);
  }
  return { data: payload as unknown as T, allowance };
}
