import { NextRequest, NextResponse } from "next/server";
import { createClient, type User } from "@supabase/supabase-js";

import { getServiceClient } from "@/lib/serverAdmin";
import { authEmailSenderVerified, SENDER_NOT_READY_MESSAGE } from "@/lib/email/senderGate";
import { allow, handleSignupRequest, safeFirstName, type AuthUserLite, type SignupDeps } from "@/lib/email/signupRecovery";

export const dynamic = "force-dynamic";

// The visitor always gets the same plain answer ({ ok: true }) whether the address is new, unconfirmed or already a member,
// so this page cannot be used to find out who has an account. What differs is only the email Supabase sends, and Supabase is
// only allowed to send once the project sends as VLTD (the sender gate). The one visible exception is "founding spots full",
// which is already public on /api/launch-access.

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return (forwarded?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown").trim();
}

export async function POST(req: NextRequest) {
  // First check, before anything can send: no VLTD sender, no email, no account created.
  if (!authEmailSenderVerified()) {
    return NextResponse.json({ error: "sender_not_ready", message: SENDER_NOT_READY_MESSAGE }, { status: 503 });
  }

  const svc = getServiceClient();
  if (!svc) return NextResponse.json({ error: "not_configured", message: "Sign up is unavailable right now." }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const firstName = typeof body?.firstName === "string" ? safeFirstName(body.firstName) : "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "invalid_email", message: "Please enter a valid email address." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "weak_password", message: "Use at least 8 characters for your password." }, { status: 400 });
  }

  // Address/IP limits. Over the IP limit: a plain "try later". Over the per-address limit: the neutral answer, nothing sent.
  if (!allow(`ip:${clientIp(req)}`, 8, 10 * 60_000)) {
    return NextResponse.json({ error: "rate_limited", message: "Too many attempts. Please try again in a few minutes." }, { status: 429 });
  }
  if (!allow(`email:${email}`, 4, 60 * 60_000)) {
    return NextResponse.json({ ok: true });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;

  const deps: SignupDeps = {
    async findUserByEmail(target) {
      for (let page = 1; page <= 20; page++) {
        const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw error;
        const hit = data.users.find((u: User) => (u.email ?? "").toLowerCase() === target);
        if (hit) return hit as AuthUserLite;
        if (data.users.length < 1000) break;
      }
      return null;
    },
    async savedName(userId) {
      const { data } = await svc.from("profiles").select("display_name, username").eq("user_id", userId).order("created_at", { ascending: true }).limit(1);
      const row = data?.[0];
      // Saved display name first, then saved username. Never anything derived from the email address.
      for (const value of [row?.display_name, row?.username]) {
        if (typeof value === "string" && value.trim()) return value;
      }
      return null;
    },
    async setFirstName(user, firstName) {
      // Merge into the existing metadata so nothing already saved on the account is lost.
      await svc.auth.admin.updateUserById(user.id, { user_metadata: { ...(user.user_metadata ?? {}), first_name: firstName } });
    },
    async supabaseReset(to, redirectTo) {
      const { error } = await svc.auth.resetPasswordForEmail(to, { redirectTo });
      if (error) throw error;
    },
    async supabaseResend(to) {
      const { error } = await svc.auth.resend({ type: "signup", email: to });
      if (error) throw error;
    },
    async supabaseSignUp(to, pw, name) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !anon) return { errorMessage: "not_configured" };
      const standard = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
      const { error } = await standard.auth.signUp({ email: to, password: pw, options: name ? { data: { first_name: name } } : undefined });
      return error ? { errorMessage: error.message } : {};
    },
    now: () => Date.now(),
  };

  try {
    const outcome = await handleSignupRequest({ email, password, firstName }, deps, { siteUrl });
    if (outcome === "founding_full") {
      return NextResponse.json({ error: "founding_full", message: "All 50 founding spots have been claimed. Join the waitlist for the next opening." }, { status: 409 });
    }
    if (outcome === "failed") {
      return NextResponse.json({ error: "send_failed", message: "We couldn't complete that just now. Please try again in a moment." }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "server_error", message: "We couldn't complete that just now. Please try again in a moment." }, { status: 500 });
  }
}
