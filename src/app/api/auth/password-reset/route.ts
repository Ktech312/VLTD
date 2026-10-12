import { NextRequest, NextResponse } from "next/server";

import { getServiceClient } from "@/lib/serverAdmin";
import { authEmailSenderVerified, SENDER_NOT_READY_MESSAGE } from "@/lib/email/senderGate";
import { allow } from "@/lib/email/signupRecovery";

export const dynamic = "force-dynamic";

// Password reset, triggered by the app only while the production project sends as VLTD (the sender gate).
// The answer is the same whether or not the address has an account.

const ALLOWED_RETURN_PATHS = new Set(["/reset-password", "/account/security"]);

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return (forwarded?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown").trim();
}

export async function POST(req: NextRequest) {
  if (!authEmailSenderVerified()) {
    return NextResponse.json({ error: "sender_not_ready", message: SENDER_NOT_READY_MESSAGE }, { status: 503 });
  }
  const svc = getServiceClient();
  if (!svc) return NextResponse.json({ error: "not_configured", message: "Password reset is unavailable right now." }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const returnPath = typeof body?.returnPath === "string" && ALLOWED_RETURN_PATHS.has(body.returnPath) ? body.returnPath : "/reset-password";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "invalid_email", message: "Please enter a valid email address." }, { status: 400 });
  }

  if (!allow(`ip:${clientIp(req)}`, 8, 10 * 60_000)) {
    return NextResponse.json({ error: "rate_limited", message: "Too many attempts. Please try again in a few minutes." }, { status: 429 });
  }
  if (!allow(`reset:${email}`, 3, 60 * 60_000)) {
    return NextResponse.json({ ok: true });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const { error } = await svc.auth.resetPasswordForEmail(email, { redirectTo: `${siteUrl.replace(/\/+$/, "")}${returnPath}` });
  if (error) {
    return NextResponse.json({ error: "send_failed", message: "We couldn't complete that just now. Please try again in a moment." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
