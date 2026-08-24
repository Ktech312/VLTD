import { NextRequest, NextResponse } from "next/server";
import { getAdminEmail, getServiceClient } from "@/lib/serverAdmin";

// The manual fallback for when the automated feeds (SerpApi outage, AI
// credits, whatever) come up empty -- EK finds a real event by hand (Google,
// a bookmarklet grabbing the page title/link) and adds it directly. No AI,
// no third-party API, just a straight insert.

function slugify(name: string, startsAt: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "event"}-${startsAt.slice(0, 10)}`;
}

export async function POST(req: NextRequest) {
  const svc = getServiceClient();
  if (!svc) return NextResponse.json({ error: "not_configured", message: "Service unavailable." }, { status: 503 });

  const admin = await getAdminEmail(req, svc);
  if (!admin) return NextResponse.json({ error: "forbidden", message: "Admins only." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const name = String(body?.name ?? "").trim();
  const startDate = String(body?.startDate ?? "").trim();
  const endDate = String(body?.endDate ?? "").trim() || startDate;
  const city = String(body?.city ?? "").trim() || null;
  const link = String(body?.link ?? "").trim() || null;
  const shortDesc = String(body?.shortDesc ?? "").trim() || null;
  const rawImageUrl = String(body?.imageUrl ?? "").trim();
  const imageUrl = /^https?:\/\//i.test(rawImageUrl) ? rawImageUrl : null;

  if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return NextResponse.json({ error: "bad_request", message: "Name and a valid start date are required." }, { status: 400 });
  }

  const startsAt = `${startDate}T00:00:00.000Z`;
  const endsAt = `${/^\d{4}-\d{2}-\d{2}$/.test(endDate) ? endDate : startDate}T23:59:59.000Z`;
  const slug = slugify(name, startsAt);

  const { error } = await svc.from("collector_events").upsert(
    {
      slug,
      name,
      short_desc: shortDesc,
      starts_at: startsAt,
      ends_at: endsAt,
      city,
      website_url: link,
      ticket_url: link,
      image_url: imageUrl,
      country: "US",
    },
    { onConflict: "slug" },
  );

  if (error) {
    return NextResponse.json({ error: "db_error", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, slug });
}
