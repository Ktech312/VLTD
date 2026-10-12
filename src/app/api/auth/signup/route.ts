import { NextRequest, NextResponse } from "next/server";
import { createClient, type User } from "@supabase/supabase-js";

import { getServiceClient } from "@/lib/serverAdmin";
import { emailConfigured, replyInboxMonitored, sendEmail } from "@/lib/email/send";
import { allow, handleSignupRequest, type AuthUserLite, type SignupDeps } from "@/lib/email/signupRecovery";

export const dynamic = "force-dynamic";

// The visitor always gets the same plain answer ({ ok: true }) whether the address is new, unconfirmed or already a member,
// so this page cannot be used to find out who has an account. What differs is only the email that goes out.
// The one visible exception is "founding spots full", which is already public on /api/launch-access.

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return (forwarded?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown").trim();
}

export async function POST(req: NextRequest) {
  const svc = getServiceClient();
  if (!svc) return NextResponse.json({ error: "not_configured", message: "Sign up is unavailable right now." }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
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
    emailConfigured: emailConfigured(),
    async findUserByEmail(target) {
      for (let page = 1; page <= 20; page++) {
        const { data, error } = await svc!.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw error;
        const hit = data.users.find((u: User) => (u.email ?? "").toLowerCase() === target);
        if (hit) return hit as AuthUserLite;
        if (data.users.length < 1000) break;
      }
      return null;
    },
    async savedName(userId) {
      const { data } = await svc!.from("profiles").select("display_name").eq("user_id", userId).order("created_at", { ascending: true }).limit(1);
      const name = data?.[0]?.display_name;
      return typeof name === "string" && name.trim() ? name : null;
    },
    async generateLink({ type, email: to, password: pw, redirectTo }) {
      const params =
        type === "signup"
          ? { type: "signup" as const, email: to, password: pw ?? "", options: redirectTo ? { redirectTo } : undefined }
          : type === "recovery"
            ? { type: "recovery" as const, email: to, options: redirectTo ? { redirectTo } : undefined }
            : { type: "magiclink" as const, email: to, options: redirectTo ? { redirectTo } : undefined };
      const { data, error } = await svc!.auth.admin.generateLink(params);
      if (error) return { errorMessage: error.message };
      return { actionLink: data?.properties?.action_link };
    },
    sendEmail,
    async supabaseReset(to, redirectTo) {
      await svc!.auth.resetPasswordForEmail(to, { redirectTo });
    },
    async supabaseResend(to) {
      await svc!.auth.resend({ type: "signup", email: to });
    },
    async supabaseSignUp(to, pw) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !anon) return { errorMessage: "not_configured" };
      const standard = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
      const { error } = await standard.auth.signUp({ email: to, password: pw });
      return error ? { errorMessage: error.message } : {};
    },
    now: () => Date.now(),
  };

  try {
    const outcome = await handleSignupRequest({ email, password }, deps, { siteUrl, replyInvite: replyInboxMonitored() });
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
