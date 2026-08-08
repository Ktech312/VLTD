import { NextRequest, NextResponse } from "next/server";
import { getAdminEmail, getServiceClient } from "@/lib/serverAdmin";

export async function GET(req: NextRequest) {
  const svc = getServiceClient();
  if (!svc) return NextResponse.json({ error: "not_configured", message: "Service unavailable." }, { status: 503 });

  const admin = await getAdminEmail(req, svc);
  if (!admin) return NextResponse.json({ error: "forbidden", message: "Admins only." }, { status: 403 });

  const { data, error } = await svc
    .from("bug_reports")
    .select("id, email, message, screenshot_url, page_path, user_agent, status, created_at, admin_reply, admin_replied_at")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    return NextResponse.json({ error: "db_error", message: error.message }, { status: 500 });
  }
  return NextResponse.json({ rows: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  const svc = getServiceClient();
  if (!svc) return NextResponse.json({ error: "not_configured", message: "Service unavailable." }, { status: 503 });

  const admin = await getAdminEmail(req, svc);
  if (!admin) return NextResponse.json({ error: "forbidden", message: "Admins only." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const id = typeof body?.id === "string" ? body.id : "";
  const status = typeof body?.status === "string" ? body.status : "";
  const reply = typeof body?.reply === "string" ? body.reply.trim() : undefined;

  if (!id) {
    return NextResponse.json({ error: "bad_request", message: "id required." }, { status: 400 });
  }
  if (status && !["open", "resolved"].includes(status)) {
    return NextResponse.json({ error: "bad_request", message: "invalid status." }, { status: 400 });
  }
  if (!status && reply === undefined) {
    return NextResponse.json({ error: "bad_request", message: "status or reply required." }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (status) patch.status = status;
  if (reply !== undefined) {
    patch.admin_reply = reply || null;
    patch.admin_replied_at = reply ? new Date().toISOString() : null;
  }

  const { error } = await svc.from("bug_reports").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: "db_error", message: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
