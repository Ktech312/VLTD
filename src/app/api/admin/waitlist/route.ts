import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Service-role client — server only. Reads the (RLS-locked) waitlist and sends
// Supabase invite emails. Never expose the service key to the browser.
function getServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// Verify the caller is an admin. The browser sends its Supabase access token as
// `Authorization: Bearer <token>`; we validate it and check owner email / user_roles.
async function getAdminEmail(req: NextRequest, svc: SupabaseClient): Promise<string | null> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;

  const { data, error } = await svc.auth.getUser(token);
  const email = data.user?.email?.toLowerCase() ?? "";
  if (error || !email) return null;

  const ownerEmail = (process.env.NEXT_PUBLIC_OWNER_EMAIL ?? "").toLowerCase();
  if (ownerEmail && email === ownerEmail) return email;

  const { data: role } = await svc
    .from("user_roles")
    .select("role")
    .eq("email", email)
    .maybeSingle();

  return role ? email : null;
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
