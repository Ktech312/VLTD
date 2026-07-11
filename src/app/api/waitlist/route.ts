import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 500) : null;
  const source = typeof body?.source === "string" ? body.source : "landing";
  const consentedAt = typeof body?.consented_at === "string" ? body.consented_at : null;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "invalid_email", message: "Please enter a valid email address." }, { status: 400 });
  }

  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "not_configured", message: "Service unavailable." }, { status: 503 });
  }

  let { error } = await supabase
    .from("beta_waitlist")
    .insert({ email, note, source, consented_at: consentedAt });

  // Backward-compat: if the consented_at column hasn't been migrated yet,
  // retry without it so the waitlist keeps working. (42703 = undefined_column,
  // PGRST204 = column not found in schema cache.)
  if (error && (error.code === "42703" || error.code === "PGRST204")) {
    ({ error } = await supabase.from("beta_waitlist").insert({ email, note, source }));
  }

  if (error) {
    // Unique constraint — already on the list
    if (error.code === "23505") {
      return NextResponse.json({ already: true, message: "You're already on the list — we'll be in touch!" });
    }
    return NextResponse.json({ error: "db_error", message: "Couldn't save your request. Try again." }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: "You're on the list! We'll reach out with your invite." });
}
