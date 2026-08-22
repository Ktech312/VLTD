import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/clubs/notify-reddit
 *
 * Internal-only endpoint -- called by the notify_reddit_on_new_club_post
 * Postgres trigger (supabase/migrations/20260822_clubs_reddit_notify.sql)
 * the instant a club post is inserted for a club with a subreddit
 * configured. Same shared-secret pattern as /api/push/send-internal --
 * the caller is the database itself, not a signed-in person.
 *
 * Unlike Discord (a webhook URL is itself the credential, so Postgres can
 * call it directly), Reddit requires real OAuth -- there's no way around
 * a server-side round trip for this one.
 *
 * NEEDS, in Vercel env vars, before this can do anything:
 *   REDDIT_CLIENT_ID       -- from a "script" app at reddit.com/prefs/apps
 *   REDDIT_CLIENT_SECRET   -- same app
 *   REDDIT_BOT_USERNAME    -- a real Reddit account the posts appear as
 *   REDDIT_BOT_PASSWORD    -- that account's password
 *   CLUBS_INTERNAL_SECRET  -- shared secret, same value stored in Supabase
 *                             Vault under the name 'clubs_internal_secret'
 *                             (given to EK in chat, never committed)
 *
 * Genuinely UNVERIFIED end-to-end -- there's no way to test the real
 * Reddit OAuth handshake without those credentials existing. If this comes
 * back broken, that's the first thing to check, not the trigger or the
 * shared-secret check below (those follow the exact same shape as the
 * already-proven push-notification route).
 */

const REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID ?? "";
const REDDIT_CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET ?? "";
const REDDIT_BOT_USERNAME = process.env.REDDIT_BOT_USERNAME ?? "";
const REDDIT_BOT_PASSWORD = process.env.REDDIT_BOT_PASSWORD ?? "";
const CLUBS_INTERNAL_SECRET = process.env.CLUBS_INTERNAL_SECRET ?? "";
const USER_AGENT = "VLTD/1.0 (collector clubs cross-post; https://vltd.vercel.app)";

type NotifyBody = {
  subreddit?: string;
  title?: string;
  body?: string;
};

async function getRedditAccessToken(): Promise<string | null> {
  const basicAuth = Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`).toString("base64");
  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: new URLSearchParams({
      grant_type: "password",
      username: REDDIT_BOT_USERNAME,
      password: REDDIT_BOT_PASSWORD,
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json().catch(() => null)) as { access_token?: string } | null;
  return data?.access_token ?? null;
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  if (!CLUBS_INTERNAL_SECRET || authHeader !== `Bearer ${CLUBS_INTERNAL_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET || !REDDIT_BOT_USERNAME || !REDDIT_BOT_PASSWORD) {
    return NextResponse.json({ error: "Reddit cross-posting not configured yet -- missing env vars." }, { status: 503 });
  }

  let payload: NotifyBody;
  try {
    payload = (await req.json()) as NotifyBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const subreddit = String(payload.subreddit ?? "").trim();
  const title = String(payload.title ?? "").trim().slice(0, 300);
  const body = String(payload.body ?? "").trim();
  if (!subreddit || !title) {
    return NextResponse.json({ error: "Missing subreddit or title" }, { status: 400 });
  }

  const accessToken = await getRedditAccessToken();
  if (!accessToken) {
    return NextResponse.json({ error: "Reddit authentication failed" }, { status: 502 });
  }

  const submitRes = await fetch("https://oauth.reddit.com/api/submit", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: new URLSearchParams({
      sr: subreddit,
      kind: "self",
      title,
      text: body,
      api_type: "json",
    }),
  });

  if (!submitRes.ok) {
    const text = await submitRes.text().catch(() => "");
    return NextResponse.json({ error: `Reddit submit failed: ${text || submitRes.status}` }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
