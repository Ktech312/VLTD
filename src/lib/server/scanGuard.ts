import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServiceClient } from "@/lib/serverAdmin";
import { isOwnerEmail } from "@/lib/ownerAccess";

// The gate in front of every paid AI scan (api/ai/analyze-item and api/ai/analyze-coa).
//
// Nothing reaches the AI provider unless ALL of these hold, checked in this order, each one before any paid request:
//   1. the caller is signed in (the Supabase access token is verified by Supabase, server side);
//   2. the image is a real, small-enough JPEG, PNG, WebP or GIF (checked from its bytes, not from the name or the type the browser claims);
//   3. the VERIFIED caller (the user id Supabase returned for the token, never anything the browser says) is a member of the profile named in the request AND that profile has an
//      AI scan left in its existing monthly allowance. One scan is RESERVED atomically in the database before the provider is called;
//   4. the same request id has not already been reserved or finished (a double press or a replay spends nothing).
// When the provider then fails (it could not be reached, it refused, it was busy) the scan is given back. When it answered, the scan stays spent.
//
// WHO DECIDES: only this server. Reserving, completing and refunding are done with the service role; the database functions refuse every other caller, so a signed-in browser
// can neither mark its own in-flight reservation complete nor refund it. (It is also why the service role is used even for the older consume_bulk_scan: called with a member's own
// token it answers "granted" but the billing-column trigger on profiles silently undoes the counter change, so the allowance would never move.)
//
// Two modes, chosen by what the database has:
//   full   reserve_ai_scan / complete_ai_scan exist (SQL package 10): repeated requests are recognised in the database, failures give the scan back.
//   basic  they do not exist yet: this server checks the membership itself (profile_members, for the verified user) and then uses the existing atomic consume_bulk_scan(profile, 1)
//          as the service role before the call. A repeated request is recognised only within this server instance's memory, and a failed provider call is not given back.
//          Everything else (sign-in, membership, allowance, image checks) is identical.
// No allowance numbers are invented here: the limits, tiers, per-person overrides and the signup-anniversary cycle are the ones the database already has.

export const MAX_IMAGE_BYTES = 4_000_000; // Vercel refuses request bodies over 4.5 MB; a phone photo is resized well below this before it is sent
export const MIN_IMAGE_BYTES = 200;
export const MIN_DIMENSION = 8;
export const MAX_DIMENSION = 8000; // the provider's own ceiling
export const SCAN_HINT_MAX_CHARS = 1500;
export const SCAN_FIELD_MAX_CHARS = 120;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ScanKind = "item" | "coa";
export type ScanMime = "image/jpeg" | "image/png" | "image/webp" | "image/gif";
export type ImageCheck =
  | { ok: true; mime: ScanMime; width: number; height: number }
  | { ok: false; status: 400 | 413 | 415; code: "invalid_image" | "too_large" | "unsupported_type"; message: string };

const be16 = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const be32 = (b: Uint8Array, i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
const le16 = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const le24 = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
const ascii = (b: Uint8Array, i: number, n: number) => String.fromCharCode(...b.slice(i, i + n));

function jpegSize(b: Uint8Array): { width: number; height: number } | null {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    while (b[i + 1] === 0xff) i += 1; // fill bytes
    const marker = b[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return { height: be16(b, i + 5), width: be16(b, i + 7) };
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { i += 2; continue; }
    const len = be16(b, i + 2);
    if (len < 2) return null;
    i += 2 + len;
  }
  return null;
}

function webpSize(b: Uint8Array): { width: number; height: number } | null {
  const chunk = ascii(b, 12, 4);
  if (chunk === "VP8 " && b.length >= 30) return { width: le16(b, 26) & 0x3fff, height: le16(b, 28) & 0x3fff };
  if (chunk === "VP8L" && b.length >= 25) return { width: 1 + (((b[22] & 0x3f) << 8) | b[21]), height: 1 + (((b[24] & 0x0f) << 10) | (b[23] << 2) | ((b[22] & 0xc0) >> 6)) };
  if (chunk === "VP8X" && b.length >= 30) return { width: 1 + le24(b, 24), height: 1 + le24(b, 27) };
  return null;
}

/** What the bytes really are and how big the picture is. Pure: used before any reservation or paid request. */
export function inspectImage(bytes: Uint8Array): ImageCheck {
  if (bytes.length > MAX_IMAGE_BYTES) return { ok: false, status: 413, code: "too_large", message: "That photo is too large to scan (the limit is 4 MB). Use a smaller photo." };
  if (bytes.length < MIN_IMAGE_BYTES) return { ok: false, status: 400, code: "invalid_image", message: "That file is empty or too small to be a photo." };
  let mime: ScanMime | null = null;
  let size: { width: number; height: number } | null = null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    mime = "image/jpeg";
    size = jpegSize(bytes);
  } else if (bytes[0] === 0x89 && ascii(bytes, 1, 3) === "PNG" && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    mime = "image/png";
    size = ascii(bytes, 12, 4) === "IHDR" ? { width: be32(bytes, 16), height: be32(bytes, 20) } : null;
  } else if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    mime = "image/webp";
    size = webpSize(bytes);
  } else if (ascii(bytes, 0, 4) === "GIF8") {
    mime = "image/gif";
    size = { width: le16(bytes, 6), height: le16(bytes, 8) };
  }
  if (!mime) return { ok: false, status: 415, code: "unsupported_type", message: "That file is not a JPEG, PNG, WebP or GIF photo." };
  if (!size || size.width < MIN_DIMENSION || size.height < MIN_DIMENSION || size.width > MAX_DIMENSION || size.height > MAX_DIMENSION) {
    return { ok: false, status: 400, code: "invalid_image", message: `That photo cannot be read (its size must be between ${MIN_DIMENSION} and ${MAX_DIMENSION} pixels each way).` };
  }
  return { ok: true, mime, width: size.width, height: size.height };
}

export type Allowance = { limit: number; used: number; remaining: number; resetsOn: string | null };

type ReserveResult =
  | { ok: true; mode: "full" | "basic"; outcome: "reserved" | "duplicate" | "limit"; allowance: Allowance }
  | { ok: false; reason: "not_member" | "unavailable"; detail: string };

// Basic mode only: request ids this server instance has already reserved (ten minutes), so a double press that reaches the same instance still spends once.
const basicSeen = new Map<string, number>();
const BASIC_TTL_MS = 10 * 60_000;
function basicRemember(key: string, now = Date.now()) {
  for (const [k, at] of basicSeen) if (now - at > BASIC_TTL_MS) basicSeen.delete(k);
  if (basicSeen.size > 5000) basicSeen.clear();
  basicSeen.set(key, now);
}
/** For tests. */
export function __resetBasicDedupe() {
  basicSeen.clear();
}

const missingFunction = (e: { code?: string; message?: string }) => e.code === "PGRST202" || e.code === "42883" || /could not find the function|function .* does not exist/i.test(e.message ?? "");
const notAuthorised = (e: { code?: string; message?: string }) => /not authorized|permission denied|profile not found/i.test(e.message ?? "") || e.code === "42501";

type RpcRow = Record<string, unknown>;
const firstRow = (data: unknown): RpcRow | null => (Array.isArray(data) ? ((data[0] as RpcRow) ?? null) : (data as RpcRow | null));

async function reserve(svc: SupabaseClient, userId: string, profileId: string, requestId: string, kind: ScanKind): Promise<ReserveResult> {
  const key = `${profileId}:${requestId}`;
  const { data, error } = await svc.rpc("reserve_ai_scan", { p_user: userId, p_profile: profileId, p_request: requestId, p_kind: kind });
  if (!error) {
    const row = firstRow(data);
    const outcome = String(row?.outcome ?? "");
    if (!row || (outcome !== "reserved" && outcome !== "duplicate" && outcome !== "limit")) return { ok: false, reason: "unavailable", detail: "unreadable reservation answer" };
    return { ok: true, mode: "full", outcome, allowance: { limit: Number(row.scan_limit ?? 0), used: Number(row.used ?? 0), remaining: Number(row.remaining ?? 0), resetsOn: row.cycle_end ? String(row.cycle_end) : null } };
  }
  if (notAuthorised(error)) return { ok: false, reason: "not_member", detail: error.message };
  if (!missingFunction(error)) return { ok: false, reason: "unavailable", detail: `${error.code ?? ""} ${error.message}`.trim().slice(0, 200) };

  // Basic mode (SQL package 10 not run yet). The service role does not go through the database's membership guard, so the membership of the VERIFIED user is checked here first.
  if (profileId !== userId) {
    const member = await svc.from("profile_members").select("profile_id").eq("profile_id", profileId).eq("user_id", userId).limit(1);
    if (member.error) return { ok: false, reason: "unavailable", detail: `${member.error.code ?? ""} ${member.error.message}`.trim().slice(0, 200) };
    if (!member.data || member.data.length === 0) return { ok: false, reason: "not_member", detail: "not a member of that profile" };
  }
  if (basicSeen.has(key)) return { ok: true, mode: "basic", outcome: "duplicate", allowance: { limit: 0, used: 0, remaining: 0, resetsOn: null } };
  // Roll a lapsed allowance cycle forward under the server's own authority first (a member's own call to this would be half-undone by the billing-column trigger).
  await svc.rpc("bulk_scan_status", { p_profile: profileId });
  const spent = await svc.rpc("consume_bulk_scan", { p_profile: profileId, p_count: 1 });
  if (spent.error) {
    if (notAuthorised(spent.error)) return { ok: false, reason: "not_member", detail: spent.error.message };
    return { ok: false, reason: "unavailable", detail: `${spent.error.code ?? ""} ${spent.error.message}`.trim().slice(0, 200) };
  }
  const row = firstRow(spent.data);
  if (!row) return { ok: false, reason: "unavailable", detail: "unreadable allowance answer" };
  const allowance: Allowance = { limit: Number(row.scan_limit ?? 0), used: Number(row.used ?? 0), remaining: Number(row.remaining ?? 0), resetsOn: null };
  if (Number(row.granted ?? 0) < 1) return { ok: true, mode: "basic", outcome: "limit", allowance };
  basicRemember(key);
  return { ok: true, mode: "basic", outcome: "reserved", allowance };
}

async function complete(svc: SupabaseClient, profileId: string, requestId: string, succeeded: boolean): Promise<Allowance | null> {
  try {
    const { data, error } = await svc.rpc("complete_ai_scan", { p_profile: profileId, p_request: requestId, p_succeeded: succeeded });
    if (error) {
      console.error("[scan-guard] could not complete the reservation:", error.message);
      return null;
    }
    const row = firstRow(data);
    return row ? { limit: Number(row.scan_limit ?? 0), used: Number(row.used ?? 0), remaining: Number(row.remaining ?? 0), resetsOn: null } : null;
  } catch (err) {
    console.error("[scan-guard] could not complete the reservation:", String(err));
    return null;
  }
}

export type ScanContext = { form: FormData; bytes: Uint8Array; mime: ScanMime; base64: string; profileId: string; userId: string; apiKey: string };
/** ok: the provider answered (the scan stays spent). refund: the provider did not give a usable paid answer, so the scan is given back. */
export type ScanRun = { ok: true; body: Record<string, unknown> } | { ok: false; status: number; body: Record<string, unknown>; refund: boolean };

const refuse = (status: number, code: string, error: string, extra: Record<string, unknown> = {}, mode?: string) =>
  NextResponse.json({ error, code, ...extra }, { status, headers: mode ? { "x-scan-guard": mode } : undefined });

function formatDay(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Cut free-text fields that go into the prompt so one request cannot carry an enormous prompt. */
export function clip(value: FormDataEntryValue | null, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

export async function guardedScan(req: NextRequest, kind: ScanKind, run: (ctx: ScanContext) => Promise<ScanRun>): Promise<NextResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return refuse(503, "not_configured", "AI identification is not configured.");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return refuse(503, "unavailable", "AI scanning is temporarily unavailable. Fill the details in by hand for now.");

  // 1. signed in, verified by Supabase
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return refuse(401, "signin", "Sign in to use AI scans. If you are signed in, reload the page and try again.");
  let userId: string | null = null;
  let ownerVerified = false;
  try {
    const verifier = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await verifier.auth.getUser(token);
    userId = error ? null : data.user?.id ?? null;
    // PRODUCT RULE: only the owner's account has AI access. Decided from the identity Supabase just verified (a confirmed email), never from anything the browser sends.
    ownerVerified = !error && Boolean(data.user?.email_confirmed_at) && isOwnerEmail(data.user?.email);
    if (error && /fetch failed|network|timeout|ECONN|ENOTFOUND/i.test(error.message)) return refuse(503, "unavailable", "AI scanning is temporarily unavailable. Fill the details in by hand for now.");
  } catch {
    return refuse(503, "unavailable", "AI scanning is temporarily unavailable. Fill the details in by hand for now.");
  }
  if (!userId) return refuse(401, "signin", "Your sign-in has expired. Sign in again to use AI scans.");
  // Everyone else is refused here: before the form is read, before any membership or allowance lookup, before anything is reserved, before the provider.
  if (!ownerVerified) return refuse(403, "owner_only", "AI scans are not available on this account.");

  // the request itself
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return refuse(400, "invalid_request", "That scan request could not be read.");
  }
  const profileId = String(form.get("profileId") ?? "").trim();
  if (!UUID.test(profileId)) return refuse(400, "profile_required", "Choose which profile this scan is for and try again.");
  const requestId = String(form.get("requestId") ?? "").trim();
  if (!UUID.test(requestId)) return refuse(400, "request_id_required", "That scan request is out of date. Reload the page and try again.");

  // 2. the image, from its bytes, before anything is reserved or paid for
  const image = form.get("image");
  if (!(image instanceof File)) return refuse(400, "invalid_image", "Missing image upload.");
  if (image.size > MAX_IMAGE_BYTES) return refuse(413, "too_large", "That photo is too large to scan (the limit is 4 MB). Use a smaller photo.");
  const bytes = new Uint8Array(await image.arrayBuffer());
  const checked = inspectImage(bytes);
  if (!checked.ok) return refuse(checked.status, checked.code, checked.message);

  // 3 and 4. membership of the verified user, the allowance and the request id, decided atomically in the database by the trusted server
  const svc = getServiceClient();
  if (!svc) {
    console.error("[scan-guard] the service client is not configured");
    return refuse(503, "unavailable", "AI scanning is temporarily unavailable. Fill the details in by hand for now.");
  }
  const reserved = await reserve(svc, userId, profileId, requestId, kind);
  if (!reserved.ok) {
    if (reserved.reason === "not_member") return refuse(403, "not_member", "That profile is not yours, so it cannot use AI scans.");
    console.error("[scan-guard] reservation unavailable:", reserved.detail);
    return refuse(503, "unavailable", "AI scanning is temporarily unavailable. Fill the details in by hand for now.");
  }
  if (reserved.outcome === "duplicate") return refuse(409, "duplicate", "That scan was already counted. Wait for its result instead of sending it again.", {}, reserved.mode);
  if (reserved.outcome === "limit") {
    const resets = formatDay(reserved.allowance.resetsOn);
    return refuse(429, "limit", `You've used all ${reserved.allowance.limit} of your AI scans for this cycle${resets ? ` (they reset ${resets})` : ""}. Fill this one in by hand.`, { remaining: 0, limit: reserved.allowance.limit, used: reserved.allowance.used }, reserved.mode);
  }

  // the paid call
  let result: ScanRun;
  try {
    result = await run({ form, bytes, mime: checked.mime, base64: Buffer.from(bytes).toString("base64"), profileId, userId, apiKey });
  } catch (err) {
    result = { ok: false, status: 500, body: { error: err instanceof Error ? err.message : "Unknown AI analysis error." }, refund: true };
  }

  let allowance = reserved.allowance;
  if (reserved.mode === "full") {
    // Only this server says whether the provider answered and whether a refund is due.
    const after = await complete(svc, profileId, requestId, result.ok || !result.refund);
    if (after) allowance = { ...allowance, ...after, resetsOn: allowance.resetsOn };
  }
  const allowanceBody = { remaining: allowance.remaining, limit: allowance.limit, used: allowance.used };
  if (result.ok) return NextResponse.json({ ...result.body, allowance: allowanceBody }, { headers: { "x-scan-guard": reserved.mode } });
  return NextResponse.json({ ...result.body, allowance: allowanceBody }, { status: result.status, headers: { "x-scan-guard": reserved.mode } });
}

export type VisionCall =
  | { kind: "ok"; text: string; usage?: { input_tokens?: number; output_tokens?: number } }
  | { kind: "busy" }
  | { kind: "failed"; status: number; details: string }
  | { kind: "network"; error: string };

/** The one place the Anthropic request is made, so both routes (and the tests) share it. */
export async function callVision(apiKey: string, base64: string, mime: ScanMime, prompt: string, maxTokens: number): Promise<VisionCall> {
  let response: Response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: maxTokens,
        messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: mime, data: base64 } }, { type: "text", text: prompt }] }],
      }),
      signal: AbortSignal.timeout(55_000),
    });
  } catch (err) {
    return { kind: "network", error: String(err) };
  }
  if (response.status === 429) return { kind: "busy" };
  if (!response.ok) return { kind: "failed", status: response.status, details: await response.text().catch(() => "") };
  const result = (await response.json().catch(() => null)) as { content?: { type: string; text: string }[]; usage?: { input_tokens?: number; output_tokens?: number } } | null;
  return { kind: "ok", text: result?.content?.[0]?.text || "{}", usage: result?.usage };
}
