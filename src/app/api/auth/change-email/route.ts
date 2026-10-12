import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { authEmailSenderVerified, SENDER_NOT_READY_MESSAGE } from "@/lib/email/senderGate";
import { allow } from "@/lib/email/signupRecovery";

export const dynamic = "force-dynamic";

// Starts an email change for the signed-in person (Supabase then sends the confirmation), only while the production project
// sends as VLTD (the sender gate). Runs as the person: their own access token, never the service key.

export async function POST(req: NextRequest) {
  if (!authEmailSenderVerified()) {
    return NextResponse.json({ error: "sender_not_ready", message: SENDER_NOT_READY_MESSAGE }, { status: 503 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return NextResponse.json({ error: "not_configured", message: "Email change is unavailable right now." }, { status: 503 });

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ error: "unauthorized", message: "Please sign in again." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const newEmail = typeof body?.email === "string" ? body.email.trim() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    return NextResponse.json({ error: "invalid_email", message: "Enter a valid email address." }, { status: 400 });
  }

  const asUser = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: who, error: whoError } = await asUser.auth.getUser(token);
  if (whoError || !who.user) return NextResponse.json({ error: "unauthorized", message: "Please sign in again." }, { status: 401 });

  if (!allow(`change-email:${who.user.id}`, 3, 60 * 60_000)) {
    return NextResponse.json({ error: "rate_limited", message: "Too many attempts. Please try again later." }, { status: 429 });
  }

  const { error } = await asUser.auth.updateUser({ email: newEmail });
  if (error) return NextResponse.json({ error: "change_failed", message: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
