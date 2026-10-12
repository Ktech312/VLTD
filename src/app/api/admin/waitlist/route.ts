import type { SupabaseClient, User } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getAdminEmail, getServiceClient } from "@/lib/serverAdmin";
import { authEmailSenderVerified, SENDER_NOT_READY_MESSAGE } from "@/lib/email/senderGate";

// Looks one person up by email in Supabase Auth (the admin API has no lookup-by-email, so page through the users).
async function findAuthUserByEmail(svc: SupabaseClient, email: string): Promise<User | null> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (hit) return hit;
    if (data.users.length < 1000) break;
  }
  return null;
}

export async function GET(req: NextRequest) {
  const svc = getServiceClient();
  if (!svc) return NextResponse.json({ error: "not_configured", message: "Service unavailable." }, { status: 503 });

  const admin = await getAdminEmail(req, svc);
  if (!admin) return NextResponse.json({ error: "forbidden", message: "Admins only." }, { status: 403 });

  const { data, error } = await svc
    .from("beta_waitlist")
    .select("id, email, note, source, created_at, invited_at, consented_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "db_error", message: error.message }, { status: 500 });
  }
  return NextResponse.json({ rows: data ?? [] });
}

export async function POST(req: NextRequest) {
  const svc = getServiceClient();
  if (!svc) return NextResponse.json({ error: "not_configured", message: "Service unavailable." }, { status: 503 });

  const admin = await getAdminEmail(req, svc);
  if (!admin) return NextResponse.json({ error: "forbidden", message: "Admins only." }, { status: 403 });

  // No invitation (or resend) goes out unless account email is sending as VLTD.
  if (!authEmailSenderVerified()) {
    return NextResponse.json({ error: "sender_not_ready", message: SENDER_NOT_READY_MESSAGE }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "invalid_email", message: "Invalid email." }, { status: 400 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;

  // Approve + notify in one step: Supabase creates the auth user (pending) and
  // emails a set-password / accept link that lands on the app.
  const { error: inviteError } = await svc.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl}/reset-password`,
  });

  const alreadyExists =
    inviteError && /already been registered|already exists/i.test(inviteError.message ?? "");

  if (inviteError && !alreadyExists) {
    return NextResponse.json({ error: "invite_failed", message: inviteError.message }, { status: 500 });
  }

  // The invite call refuses people who already have an auth account and sends nothing. Two different people land here:
  //  - someone invited earlier who never finished (no confirmed email, never signed in): their first email was lost or
  //    expired, so send a fresh set-password link instead of reporting success with no email;
  //  - someone with a working account: nothing to send, and the response says so plainly.
  let emailSent = !alreadyExists;
  let message = "Invite sent.";
  if (alreadyExists) {
    let existing: User | null = null;
    try {
      existing = await findAuthUserByEmail(svc, email);
    } catch (err) {
      return NextResponse.json(
        { error: "lookup_failed", message: err instanceof Error ? err.message : "Could not look up the existing account." },
        { status: 500 }
      );
    }

    const neverFinished = existing && !existing.email_confirmed_at && !existing.last_sign_in_at;
    if (neverFinished) {
      const { error: resendError } = await svc.auth.resetPasswordForEmail(email, { redirectTo: `${siteUrl}/reset-password` });
      if (resendError) {
        return NextResponse.json({ error: "resend_failed", message: resendError.message }, { status: 500 });
      }
      emailSent = true;
      message = "They had an unfinished invite — a new set-password email was sent.";
    } else {
      message = "They already have an account, so no email was sent. They can log in, or use Forgot password.";
    }
  }

  // Stamp invited_at so the list reflects who's been approved.
  await svc
    .from("beta_waitlist")
    .update({ invited_at: new Date().toISOString() })
    .eq("email", email);

  return NextResponse.json({
    success: true,
    already: Boolean(alreadyExists),
    emailSent,
    message,
  });
}
