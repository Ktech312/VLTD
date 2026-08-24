import { NextRequest, NextResponse } from "next/server";
import { getAdminEmail, getServiceClient } from "@/lib/serverAdmin";

// Admin management for collector_events -- lists EVERYTHING (the
// service-role client bypasses the public "enabled AND not ended" RLS
// policy, so disabled/expired rows show up here too, not just what the
// public Events page shows) plus enable/feature toggles and delete.

export async function GET(req: NextRequest) {
  const svc = getServiceClient();
  if (!svc) return NextResponse.json({ error: "not_configured", message: "Service unavailable." }, { status: 503 });

  const admin = await getAdminEmail(req, svc);
  if (!admin) return NextResponse.json({ error: "forbidden", message: "Admins only." }, { status: 403 });

  const { data, error } = await svc
    .from("collector_events")
    .select("id, slug, name, starts_at, ends_at, city, image_url, website_url, enabled, is_featured, created_at")
    .order("created_at", { ascending: false });

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
  const id = String(body?.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "bad_request", message: "Missing id." }, { status: 400 });

  const patch: Record<string, boolean> = {};
  if (typeof body?.enabled === "boolean") patch.enabled = body.enabled;
  if (typeof body?.isFeatured === "boolean") patch.is_featured = body.isFeatured;

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "bad_request", message: "Nothing to update." }, { status: 400 });
  }

  const { error } = await svc.from("collector_events").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: "db_error", message: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const svc = getServiceClient();
  if (!svc) return NextResponse.json({ error: "not_configured", message: "Service unavailable." }, { status: 503 });

  const admin = await getAdminEmail(req, svc);
  if (!admin) return NextResponse.json({ error: "forbidden", message: "Admins only." }, { status: 403 });

  const id = new URL(req.url).searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "bad_request", message: "Missing id." }, { status: 400 });

  const { error } = await svc.from("collector_events").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "db_error", message: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
