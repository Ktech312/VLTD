import { NextRequest, NextResponse } from "next/server";
import { getAdminEmail, getServiceClient } from "@/lib/serverAdmin";

// Real per-user analytics for EK's future use: time-on-app (already tracked
// via profiles.last_seen_at / session_started_at / total_seconds_online /
// session_count, see 20260711_presence.sql + 20260818_presence_totals.sql)
// joined with AI usage (new: ai_usage_log, 20260823_ai_usage_log.sql).
export async function GET(req: NextRequest) {
  const svc = getServiceClient();
  if (!svc) return NextResponse.json({ error: "not_configured", message: "Service unavailable." }, { status: 503 });

  const admin = await getAdminEmail(req, svc);
  if (!admin) return NextResponse.json({ error: "forbidden", message: "Admins only." }, { status: 403 });

  const { data: profiles, error: profilesError } = await svc
    .from("profiles")
    .select(
      "id, user_id, display_name, username, created_at, last_seen_at, session_started_at, total_seconds_online, session_count, museum_beta_enabled, museum_beta_requested_at",
    )
    .order("created_at", { ascending: false });

  if (profilesError) {
    return NextResponse.json({ error: "db_error", message: profilesError.message }, { status: 500 });
  }

  const { data: usageRows, error: usageError } = await svc
    .from("ai_usage_log")
    .select("profile_id, input_tokens, output_tokens");

  if (usageError) {
    return NextResponse.json({ error: "db_error", message: usageError.message }, { status: 500 });
  }

  const usageByProfile = new Map<string, { calls: number; inputTokens: number; outputTokens: number }>();
  for (const row of usageRows ?? []) {
    if (!row.profile_id) continue;
    const entry = usageByProfile.get(row.profile_id) ?? { calls: 0, inputTokens: 0, outputTokens: 0 };
    entry.calls += 1;
    entry.inputTokens += row.input_tokens ?? 0;
    entry.outputTokens += row.output_tokens ?? 0;
    usageByProfile.set(row.profile_id, entry);
  }

  // Email lives in auth.users, not profiles -- join by user_id via the admin API.
  const emailByUserId = new Map<string, string>();
  for (let page = 1; ; page += 1) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data?.users?.length) break;
    for (const u of data.users) {
      if (u.email) emailByUserId.set(u.id, u.email);
    }
    if (data.users.length < 200) break;
  }

  const rows = (profiles ?? []).map((p) => {
    const usage = usageByProfile.get(p.id) ?? { calls: 0, inputTokens: 0, outputTokens: 0 };
    return {
      id: p.id,
      displayName: p.display_name,
      username: p.username,
      email: p.user_id ? emailByUserId.get(p.user_id) ?? null : null,
      createdAt: p.created_at,
      lastSeenAt: p.last_seen_at,
      sessionStartedAt: p.session_started_at,
      totalSecondsOnline: p.total_seconds_online ?? 0,
      sessionCount: p.session_count ?? 0,
      aiCalls: usage.calls,
      aiInputTokens: usage.inputTokens,
      aiOutputTokens: usage.outputTokens,
      museumBetaEnabled: !!p.museum_beta_enabled,
      museumBetaRequestedAt: p.museum_beta_requested_at,
    };
  });

  return NextResponse.json({ rows });
}

// Toggles the 3D Museum beta flag for one profile. Goes through the
// service-role client + a verified admin check, same as GET above —
// deliberately not a direct client-side `.update()` against
// admins_update_all_profiles, so this stays consistent with the
// strongest pattern already in this file rather than the RLS-only one
// used elsewhere (e.g. admin/tiers/page.tsx).
export async function PATCH(req: NextRequest) {
  const svc = getServiceClient();
  if (!svc) return NextResponse.json({ error: "not_configured", message: "Service unavailable." }, { status: 503 });

  const admin = await getAdminEmail(req, svc);
  if (!admin) return NextResponse.json({ error: "forbidden", message: "Admins only." }, { status: 403 });

  const body = await req.json().catch(() => null);
  const profileId = typeof body?.profileId === "string" ? body.profileId.trim() : "";
  const museumBetaEnabled = typeof body?.museumBetaEnabled === "boolean" ? body.museumBetaEnabled : null;

  if (!profileId || museumBetaEnabled === null) {
    return NextResponse.json(
      { error: "bad_request", message: "profileId and museumBetaEnabled are required." },
      { status: 400 },
    );
  }

  const { error } = await svc
    .from("profiles")
    .update({ museum_beta_enabled: museumBetaEnabled })
    .eq("id", profileId);

  if (error) {
    return NextResponse.json({ error: "db_error", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
