import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/serverAdmin";

// Real newsletter capture. Stores the email in public.newsletter_signups.
// No sending happens here — this is honest capture only.
export async function POST(req: NextRequest) {
  const svc = getServiceClient();
  if (!svc) {
    return NextResponse.json(
      { error: "not_configured", message: "Signups are temporarily unavailable." },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const source = typeof body?.source === "string" ? body.source.slice(0, 60) : "learn";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "invalid_email", message: "Enter a valid email address." }, { status: 400 });
  }

  const { error } = await svc.from("newsletter_signups").insert({ email, source });

  // Treat a duplicate as success — they're already on the list.
  const isDuplicate = error && /duplicate|unique/i.test(error.message ?? "");
  if (error && !isDuplicate) {
    return NextResponse.json({ error: "db_error", message: "Could not save your signup. Try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, alreadySubscribed: Boolean(isDuplicate) });
}
