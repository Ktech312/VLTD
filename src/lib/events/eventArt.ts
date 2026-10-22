import type { SupabaseClient } from "@supabase/supabase-js";

// Artwork for the Home banner. Almost no event arrives with a picture (the manual importers have none, and the searches only sometimes carry a
// thumbnail), so the daily job also looks at each banner event's own website for the picture its organiser publishes for sharing (the page's
// og:image / twitter:image), checks that it really is an image, and stores that address in collector_events.image_url, only where there is none.
//
// The address is a LINK to the organiser's picture, not a copy: it is the same kind of image_url the Events page already shows, costs no storage,
// and keeps working only as long as the organiser leaves the file where it is. When it stops loading, the banner shows its consistent fallback.

const UA = "Mozilla/5.0 (compatible; VLTDBot/1.0; +https://vltd.app)";
const PAGE_TIMEOUT_MS = 5000;
const IMAGE_TIMEOUT_MS = 4000;
const MAX_HTML_CHARS = 400_000;

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return m ? (m[2] ?? m[3] ?? m[4] ?? "").trim() : null;
}

const KEY_ORDER = ["og:image:secure_url", "og:image", "og:image:url", "twitter:image", "twitter:image:src"];

/** The share picture a page names, as an absolute https address, or null. */
export function pickMetaImage(html: string, pageUrl: string): string | null {
  const found = new Map<string, string>();
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = (attr(tag, "property") ?? attr(tag, "name") ?? "").toLowerCase();
    const content = attr(tag, "content");
    if (key && content && !found.has(key)) found.set(key, content.replace(/&amp;/g, "&"));
  }
  for (const key of KEY_ORDER) {
    const raw = found.get(key);
    if (!raw) continue;
    try {
      const url = new URL(raw, pageUrl);
      if (url.protocol === "http:") url.protocol = "https:";
      if (url.protocol !== "https:") continue;
      if (/\.(svg|ico)(\?|$)/i.test(url.pathname)) continue;
      return url.toString();
    } catch {
      /* not an address */
    }
  }
  return null;
}

/** Only public web pages: no addresses that name this machine or a private network. */
export function isPublicHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const h = u.hostname.toLowerCase();
    if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return false;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(":")) return false;
    return h.includes(".");
  } catch {
    return false;
  }
}

// "photo": fills the banner behind its words. "graphic": a PNG with transparency (a logo or title lettering, usually dark on nothing), which would vanish on
// the dark banner, so the banner shows it on a light card instead. The kind is kept as a fragment on the stored address (#photo / #graphic), which no
// server looks at, so the address still opens the picture.
export type ArtKind = "photo" | "graphic";

export function artKind(url: string | null | undefined): ArtKind | null {
  const m = (url ?? "").match(/#(photo|graphic)$/);
  return m ? (m[1] as ArtKind) : null;
}
export function withArtKind(url: string, kind: ArtKind): string {
  return `${url.split("#")[0]}#${kind}`;
}

/** PNG colour types 4 (grey + alpha) and 6 (RGB + alpha) carry transparency; the type is byte 25, inside the first kilobyte. */
export function pngHasAlpha(head: Uint8Array): boolean {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  return head.length > 25 && sig.every((b, i) => head[i] === b) && (head[25] === 4 || head[25] === 6);
}

/** null when the address is not a loadable image; otherwise which kind. */
async function probeImage(url: string, fetchImpl: typeof fetch): Promise<ArtKind | null> {
  try {
    const res = await fetchImpl(url.split("#")[0], { headers: { "user-agent": UA, range: "bytes=0-1023" }, signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS) });
    const ok = (res.ok || res.status === 206) && /^image\//i.test(res.headers.get("content-type") ?? "");
    let head = new Uint8Array(0);
    if (ok && res.body) {
      const reader = res.body.getReader();
      const first = await reader.read();
      if (first.value) head = first.value.slice(0, 1024);
      await reader.cancel().catch(() => {});
    } else await res.body?.cancel().catch(() => {});
    return ok ? (pngHasAlpha(head) ? "graphic" : "photo") : null;
  } catch {
    return null;
  }
}

export async function fetchEventArt(pageUrl: string, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  if (!isPublicHttpUrl(pageUrl)) return null;
  try {
    const res = await fetchImpl(pageUrl, { headers: { "user-agent": UA, accept: "text/html" }, redirect: "follow", signal: AbortSignal.timeout(PAGE_TIMEOUT_MS) });
    if (!res.ok || !/html/i.test(res.headers.get("content-type") ?? "html")) return null;
    const art = pickMetaImage((await res.text()).slice(0, MAX_HTML_CHARS), res.url || pageUrl);
    if (!art) return null;
    const kind = await probeImage(art, fetchImpl);
    return kind ? withArtKind(art, kind) : null;
  } catch {
    return null;
  }
}

export type ArtResult = { checked: number; filled: number; filledSlugs: string[]; classified: number; errors: string[] };

type Candidate = { slug: string; website_url: string | null; image_url?: string | null };

/** Fills image_url (never replacing one that is there) for the events the banner is most likely to show: the featured ones and the nearest. */
export async function fillBannerArt(svc: SupabaseClient, fetchImpl: typeof fetch = fetch, budgetMs = 30_000): Promise<ArtResult> {
  const deadline = Date.now() + budgetMs; // no new lookup is started after this, so the step always finishes inside the function's time limit
  const result: ArtResult = { checked: 0, filled: 0, filledSlugs: [], classified: 0, errors: [] };
  const nowIso = new Date().toISOString();
  const [featured, nearest] = await Promise.all([
    svc.from("collector_events").select("slug, website_url, image_url").eq("enabled", true).eq("is_featured", true).gte("ends_at", nowIso).order("starts_at").limit(20),
    svc.from("collector_events").select("slug, website_url, image_url").eq("enabled", true).gte("ends_at", nowIso).order("starts_at").limit(30),
  ]);
  if (featured.error) result.errors.push(`art lookup (featured): ${featured.error.message}`.slice(0, 200));
  if (nearest.error) result.errors.push(`art lookup (nearest): ${nearest.error.message}`.slice(0, 200));
  const seen = new Set<string>();
  const todo: Candidate[] = [];
  const unclassified: Candidate[] = [];
  for (const c of [...((featured.data ?? []) as Candidate[]), ...((nearest.data ?? []) as Candidate[])]) {
    if (seen.has(c.slug)) continue;
    seen.add(c.slug);
    if (!c.image_url && c.website_url) todo.push(c);
    else if (c.image_url && !artKind(c.image_url)) unclassified.push(c); // a picture saved before kinds were kept
  }
  const queue = [...todo];
  const worker = async () => {
    for (let c = queue.shift(); c; c = queue.shift()) {
      if (Date.now() > deadline) return;
      result.checked += 1;
      const art = await fetchEventArt(c.website_url as string, fetchImpl);
      if (!art) continue;
      const { error } = await svc.from("collector_events").update({ image_url: art }).eq("slug", c.slug).is("image_url", null);
      if (error) result.errors.push(`art save ${c.slug}: ${error.message}`.slice(0, 200));
      else {
        result.filled += 1;
        result.filledSlugs.push(c.slug);
      }
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  for (const c of unclassified) {
    if (Date.now() > deadline) break;
    const kind = await probeImage(c.image_url as string, fetchImpl);
    if (!kind) continue; // not loadable right now: leave it as it is
    const { error } = await svc.from("collector_events").update({ image_url: withArtKind(c.image_url as string, kind) }).eq("slug", c.slug).eq("image_url", c.image_url as string);
    if (error) result.errors.push(`art kind ${c.slug}: ${error.message}`.slice(0, 200));
    else result.classified += 1;
  }
  return result;
}
