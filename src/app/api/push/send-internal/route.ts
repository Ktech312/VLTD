import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { getServiceClient } from "@/lib/serverAdmin";

/**
 * POST /api/push/send-internal
 *
 * Internal-only endpoint -- called by the notify_push_on_new_message
 * Postgres trigger (supabase/migrations/20260821_push_notifications.sql)
 * the instant a DM is inserted, never by the browser. Auth is a shared
 * secret header (PUSH_INTERNAL_SECRET), not a user session, since the
 * caller is the database itself, not a signed-in person.
 *
 * Looks up every device the recipient profile has enabled notifications
 * on and sends via web-push (the actual Web Push protocol client --
 * Postgres can only make the HTTP call to get here, not speak push
 * directly). Dead subscriptions (404/410 -- the browser unsubscribed or
 * the push service expired it) are cleaned up as they're found, so this
 * table doesn't accumulate stale rows forever.
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:eck1679@gmail.com";
const PUSH_INTERNAL_SECRET = process.env.PUSH_INTERNAL_SECRET ?? "";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

type SendBody = {
  profileId?: string;
  title?: string;
  body?: string;
  url?: string;
};

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  if (!PUSH_INTERNAL_SECRET || authHeader !== `Bearer ${PUSH_INTERNAL_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return NextResponse.json({ error: "Push not configured yet -- missing VAPID env vars." }, { status: 503 });
  }

  const svc = getServiceClient();
  if (!svc) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  let payload: SendBody;
  try {
    payload = (await req.json()) as SendBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const profileId = String(payload.profileId ?? "").trim();
  if (!profileId) {
    return NextResponse.json({ error: "profileId required" }, { status: 400 });
  }

  const { data: subs, error } = await svc
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("profile_id", profileId);

  if (error || !subs || subs.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  const notificationPayload = JSON.stringify({
    title: payload.title || "VLTD",
    body: payload.body || "",
    url: payload.url || "/",
  });

  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint as string, keys: { p256dh: s.p256dh as string, auth: s.auth as string } },
          notificationPayload
        );
        sent += 1;
      } catch (err) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await svc.from("push_subscriptions").delete().eq("id", s.id as string);
        }
      }
    })
  );

  return NextResponse.json({ sent, total: subs.length });
}
