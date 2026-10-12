// Decides what a signup request triggers, without ever telling the website visitor which case it was.
// Every email here is sent by Supabase Auth, which is only allowed to run once the production project is set to send as VLTD
// (see senderGate.ts). Dependencies are passed in so the branching can be tested with fakes (no network, no real accounts).

export type AuthUserLite = {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  last_sign_in_at?: string | null;
  confirmation_sent_at?: string | null;
  recovery_sent_at?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

export type SignupDeps = {
  findUserByEmail(email: string): Promise<AuthUserLite | null>;
  /** The name saved on an existing account's profile (never the name typed into a duplicate signup). */
  savedName(userId: string): Promise<string | null>;
  /** Stores the safe first name on the account so the VLTD email template can greet them by name. */
  setFirstName(user: AuthUserLite, firstName: string): Promise<void>;
  supabaseReset(email: string, redirectTo: string): Promise<void>;
  supabaseResend(email: string): Promise<void>;
  supabaseSignUp(email: string, password: string): Promise<{ errorMessage?: string }>;
  now(): number;
};

export type SignupOutcome =
  | "account_created" // new person: account created, Supabase sends the confirmation email (VLTD template)
  | "reminder_sent" // unconfirmed account: confirmation email sent again
  | "recovery_sent" // confirmed account: reset email (VLTD template, greets by the saved name)
  | "cooldown" // an email went out moments ago: send nothing
  | "founding_full"
  | "failed";

export const RESEND_COOLDOWN_MS = 60_000;

const FULL_PATTERN = /50 of 50|founding access is full|database error (saving|creating) new user/i;

function recent(timestamp: string | null | undefined, now: number): boolean {
  if (!timestamp) return false;
  const at = Date.parse(timestamp);
  return Number.isFinite(at) && now - at < RESEND_COOLDOWN_MS;
}

/** A first name that is safe to store and to drop into an email: letters, marks, apostrophes and hyphens only, max 40. */
export function safeFirstName(name?: string | null): string {
  const first = String(name ?? "").trim().split(/\s+/)[0] ?? "";
  const cleaned = first.replace(/[^\p{L}\p{M}'’-]/gu, "").slice(0, 40);
  return /\p{L}/u.test(cleaned) ? cleaned : "";
}

export async function handleSignupRequest(
  input: { email: string; password: string },
  deps: SignupDeps,
  options: { siteUrl: string }
): Promise<SignupOutcome> {
  const email = input.email.trim().toLowerCase();
  const existing = await deps.findUserByEmail(email);

  // ── No account yet: the standard sign-up. The founding-spot rule runs in the database, exactly as before. ──
  if (!existing) {
    const result = await deps.supabaseSignUp(email, input.password);
    if (!result.errorMessage) return "account_created";
    return FULL_PATTERN.test(result.errorMessage) ? "founding_full" : "failed";
  }

  // ── Account exists but was never confirmed ──
  if (!existing.email_confirmed_at) {
    if (recent(existing.confirmation_sent_at, deps.now())) return "cooldown";
    await deps.supabaseResend(email);
    return "reminder_sent";
  }

  // ── Confirmed account: reset email, greeting by the name saved on THAT account (not the duplicate signup's) ──
  if (recent(existing.recovery_sent_at, deps.now())) return "cooldown";
  const first = safeFirstName(await deps.savedName(existing.id));
  if (first) await deps.setFirstName(existing, first);
  await deps.supabaseReset(email, `${options.siteUrl.replace(/\/+$/, "")}/reset-password`);
  return "recovery_sent";
}

// ── Simple in-memory rate limiting (per server instance; the cooldowns above are the durable part) ──
const buckets = new Map<string, number[]>();

export function allow(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (v.every((t) => now - t >= windowMs)) buckets.delete(k);
  }
  return true;
}
