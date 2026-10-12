// Decides what a signup request sends, without ever telling the website visitor which case it was.
// Dependencies are passed in so the branching can be tested with fakes (no network, no real accounts).
import { renderEmail, type EmailKind } from "./templates";

export type AuthUserLite = {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  last_sign_in_at?: string | null;
  confirmation_sent_at?: string | null;
  recovery_sent_at?: string | null;
};

export type SignupDeps = {
  /** True when branded email can actually be sent (provider configured). */
  emailConfigured: boolean;
  findUserByEmail(email: string): Promise<AuthUserLite | null>;
  /** The name saved on an existing account's profile (never the name typed into a duplicate signup). */
  savedName(userId: string): Promise<string | null>;
  generateLink(args: { type: "signup" | "magiclink" | "recovery"; email: string; password?: string; redirectTo?: string }): Promise<{ actionLink?: string; errorMessage?: string }>;
  sendEmail(message: { to: string; subject: string; html: string; text: string }): Promise<{ ok: boolean; error?: string }>;
  /** Supabase's own emails, used when branded email is not configured or fails, so nobody is left without a message. */
  supabaseReset(email: string, redirectTo: string): Promise<void>;
  supabaseResend(email: string): Promise<void>;
  /** The standard Supabase sign-up (Supabase sends its own confirmation email). Used for new people when branded email is not configured. */
  supabaseSignUp(email: string, password: string): Promise<{ errorMessage?: string }>;
  now(): number;
};

export type SignupOutcome =
  | "new_account_email_sent" // new person: account created, confirmation email sent (branded, or Supabase's own when branded email is not configured)
  | "reminder_sent" // unconfirmed account: confirmation reminder
  | "recovery_sent" // confirmed account: personalised "already a member" email with a reset link
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

export async function handleSignupRequest(
  input: { email: string; password: string },
  deps: SignupDeps,
  options: { siteUrl: string; replyInvite: boolean }
): Promise<SignupOutcome> {
  const email = input.email.trim().toLowerCase();
  const site = options.siteUrl.replace(/\/+$/, "");
  const existing = await deps.findUserByEmail(email);

  async function deliver(kind: EmailKind, actionUrl: string, firstName: string | null): Promise<boolean> {
    const mail = renderEmail(kind, { firstName, siteUrl: site, actionUrl, replyInvite: options.replyInvite });
    const result = await deps.sendEmail({ to: email, subject: mail.subject, html: mail.html, text: mail.text });
    return result.ok;
  }

  // ── No account yet ────────────────────────────────────────────────────────
  if (!existing) {
    if (!deps.emailConfigured) {
      const result = await deps.supabaseSignUp(email, input.password);
      if (!result.errorMessage) return "new_account_email_sent";
      return FULL_PATTERN.test(result.errorMessage) ? "founding_full" : "failed";
    }
    const link = await deps.generateLink({ type: "signup", email, password: input.password });
    if (!link.actionLink) {
      return FULL_PATTERN.test(link.errorMessage ?? "") ? "founding_full" : "failed";
    }
    // The account now exists (counted once, by the same database rule as before). If the send fails the person can
    // use "Forgot password"/sign up again; the next attempt takes the reminder path below.
    return (await deliver("welcome", link.actionLink, null)) ? "new_account_email_sent" : "failed";
  }

  const confirmed = Boolean(existing.email_confirmed_at);

  // ── Account exists but was never confirmed ───────────────────────────────
  if (!confirmed) {
    if (recent(existing.confirmation_sent_at, deps.now())) return "cooldown";
    if (deps.emailConfigured) {
      // A magic link confirms the address and signs them in; their chosen password is left untouched.
      const link = await deps.generateLink({ type: "magiclink", email });
      if (link.actionLink && (await deliver("confirm_reminder", link.actionLink, null))) return "reminder_sent";
    }
    await deps.supabaseResend(email);
    return "reminder_sent";
  }

  // ── Confirmed account: personalised recovery, using the name saved on THAT account ──
  if (recent(existing.recovery_sent_at, deps.now())) return "cooldown";
  const redirectTo = `${site}/reset-password`;
  if (deps.emailConfigured) {
    const link = await deps.generateLink({ type: "recovery", email, redirectTo });
    if (link.actionLink) {
      const name = await deps.savedName(existing.id);
      if (await deliver("existing_member", link.actionLink, name)) return "recovery_sent";
    }
  }
  await deps.supabaseReset(email, redirectTo);
  return "recovery_sent";
}

// ── Simple in-memory rate limiting (per server instance; the cooldowns above are the durable part) ──
type Bucket = number[];
const buckets = new Map<string, Bucket>();

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
