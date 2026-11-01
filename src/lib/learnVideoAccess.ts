import { LEARN_VIDEOS } from "./learnVideos";

/** Only YouTube video IDs and known YouTube share/watch URLs are accepted. */
export function youtubeVideoId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const input = value.trim();
  const valid = (id: string | null | undefined) => id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
  if (valid(input)) return input;
  try {
    const url = new URL(input);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    const host = url.hostname.replace(/^www\./, "");
    const parts = url.pathname.split("/").filter(Boolean);
    if (host === "youtu.be" && parts.length === 1) return valid(parts[0]);
    if (!["youtube.com", "m.youtube.com", "youtube-nocookie.com"].includes(host)) return null;
    if (url.pathname === "/watch") return valid(url.searchParams.get("v"));
    if (["shorts", "embed", "live"].includes(parts[0]) && parts.length === 2) return valid(parts[1]);
  } catch { /* Invalid URLs are unavailable, never embedded. */ }
  return null;
}

export function configuredVideoIds(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid video configuration");
  const result: Record<string, string> = {};
  for (const video of LEARN_VIDEOS) {
    const value = (parsed as Record<string, unknown>)[video.id];
    if (value === undefined) continue;
    const id = youtubeVideoId(value);
    if (!id) throw new Error("Invalid video configuration");
    result[video.id] = id;
  }
  return result;
}

// Shared by the real route and tests. Authorization is server-verified, not a UI flag.
export async function learnVideoResponse(req: Request, raw: string | undefined, verify: (token: string) => Promise<boolean>) {
  const json = (body: unknown, status = 200) => Response.json(body, {
    status, headers: { "Cache-Control": "private, no-store", Vary: "Authorization" },
  });
  let ids: Record<string, string>;
  try { ids = configuredVideoIds(raw); } catch { return json({ error: "Video guides are temporarily unavailable. Please try again later." }, 503); }
  const requested = new URL(req.url).searchParams.get("id");
  if (!requested) return json({ videos: LEARN_VIDEOS.map(video => ({ id: video.id, available: Boolean(ids[video.id]) })) });
  const video = LEARN_VIDEOS.find(item => item.id === requested);
  if (!video || !ids[requested]) return json({ error: "This video is not available yet." }, 404);
  if (video.access === "account") {
    const match = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") ?? "");
    let allowed = false;
    if (match) {
      try { allowed = await verify(match[1]); } catch { return json({ error: "We couldn't check your account. Please try again." }, 503); }
    }
    if (!allowed) return json({ error: "Sign in to watch this walkthrough." }, 401);
  }
  return json({ youtubeId: ids[requested] });
}
