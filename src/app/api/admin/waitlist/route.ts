import { NextRequest, NextResponse } from "next/server";
import { getAdminEmail, getServiceClient } from "@/lib/serverAdmin";

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

  // If they already have an account, treat the approval as idempotent.
  const alreadyExists =
    inviteError && /already been registered|already exists/i.test(inviteError.message ?? "");

  if (inviteError && !alreadyExists) {
    return NextResponse.json({ error: "invite_failed", message: inviteError.message }, { status: 500 });
  }

  // Stamp invited_at so the list reflects who's been approved.
  await svc
    .from("beta_waitlist")
    .update({ invited_at: new Date().toISOString() })
    .eq("email", email);

  return NextResponse.json({
    success: true,
    already: Boolean(alreadyExists),
    message: alreadyExists ? "Already had an account — marked as invited." : "Invite sent.",
  });
}
