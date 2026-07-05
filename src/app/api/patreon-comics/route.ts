import { NextResponse } from "next/server";

/**
 * GET /api/patreon-comics
 *
 * Two modes:
 *
 * 1. SEARCH mode (default): Scrapes Patreon's public search page for comic creators.
 *    Patreon has no public creator search API — their official API v2 requires
 *    OAuth and only exposes campaigns the authenticated user follows. We scrape
 *    the public search HTML instead.
 *
 * 2. LOOKUP mode (?url=): Fetches a specific creator's public Patreon page and
 *    extracts their campaign info (tier count, patron count, etc.).
 *
 * Query params:
 *   q=string       → search creators (default "comics")
 *   url=string     → look up a specific Patreon creator URL
 *
 * Returns:
 *   { creators: PatreonCreator[], source: "patreon-search" | "patreon-lookup" }
 */

const PATREON_SEARCH = "https://www.patreon.com/search";
const DEFAULT_CATEGORY = "Comics";

export type PatreonCreator = {
  name: string;
  url: string;
  imageUrl: string | null;
  blurb: string;
  category: string;
  patrons: number | null;        // null if not publicly shown
  tierCount: number | null;
  isNSFW: boolean;
  source: "patreon-search" | "patreon-lookup";
};

/* ── HTML parser helpers ─────────────────────────────────────── */

function extractMeta(html: string, property: string): string {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)="${property}"[^>]+content="([^"]*)"`,
    "i"
  );
  return html.match(re)?.[1] ?? "";
}

function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parse Patreon search results page.
 * Patreon is heavily React-rendered so we look for the server-side JSON
 * that Next.js / React injects into __NEXT_DATA__ or window.__BOOTSTRAP_DATA__.
 */
function parseSearchPage(html: string, q: string): PatreonCreator[] {
  const creators: PatreonCreator[] = [];

  // Try to extract __NEXT_DATA__ JSON
  const nextDataMatch = html.match(
    /<script[^>]+id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/
  );
  if (nextDataMatch) {
    try {
      const data = JSON.parse(nextDataMatch[1]);
      // Navigate the NEXT_DATA tree for search results
      const props = data?.props?.pageProps;
      const campaigns =
        props?.campaigns ??
        props?.searchResults ??
        props?.creators ??
        [];
      if (Array.isArray(campaigns) && campaigns.length > 0) {
        for (const c of campaigns) {
          const attrs = c?.attributes ?? c;
          creators.push({
            name: attrs?.name ?? attrs?.full_name ?? "",
            url: attrs?.url ?? `https://www.patreon.com/${attrs?.vanity ?? ""}`,
            imageUrl: attrs?.image_url ?? attrs?.avatar_photo_url ?? null,
            blurb:
              attrs?.creation_name ??
              attrs?.summary ??
              attrs?.pledge_url_description ??
              "",
            category: attrs?.main_video_embed ?? DEFAULT_CATEGORY,
            patrons: attrs?.patron_count ?? null,
            tierCount: null,
            isNSFW: attrs?.is_nsfw ?? false,
            source: "patreon-search",
          });
        }
        return creators;
      }
    } catch {
      // Fall through to HTML parsing
    }
  }

  // Fallback: parse OG / JSON-LD from the page (works for single creator pages)
  const jsonLdMatches = html.matchAll(
    /<script[^>]+type="application\/ld\+json"[^>]*>([^<]+)<\/script>/gi
  );
  for (const match of jsonLdMatches) {
    try {
      const ld = JSON.parse(match[1]);
      if (ld?.["@type"] === "Person" || ld?.["@type"] === "Organization") {
        creators.push({
          name: ld.name ?? "",
          url: ld.url ?? "",
          imageUrl: ld.image ?? null,
          blurb: ld.description ?? "",
          category: DEFAULT_CATEGORY,
          patrons: null,
          tierCount: null,
          isNSFW: false,
          source: "patreon-search",
        });
      }
    } catch {
      continue;
    }
  }

  // Last resort: grab OG tags for a single-page result
  if (creators.length === 0) {
    const title = extractMeta(html, "og:title");
    const image = extractMeta(html, "og:image");
    const description = extractMeta(html, "og:description");
    const url = extractMeta(html, "og:url");
    if (title && url) {
      creators.push({
        name: title.replace(" on Patreon", "").trim(),
        url,
        imageUrl: image || null,
        blurb: description,
        category: DEFAULT_CATEGORY,
        patrons: null,
        tierCount: null,
        isNSFW: false,
        source: "patreon-search",
      });
    }
  }

  return creators;
}

/**
 * Lookup a specific creator's public Patreon page.
 */
function parseLookupPage(html: string, url: string): PatreonCreator | null {
  // Try __NEXT_DATA__ first
  const nextDataMatch = html.match(
    /<script[^>]+id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/
  );
  if (nextDataMatch) {
    try {
      const data = JSON.parse(nextDataMatch[1]);
      const campaign =
        data?.props?.pageProps?.campaign ??
        data?.props?.pageProps?.bootstrapEnvelope?.data;
      if (campaign) {
        const attrs = campaign?.attributes ?? campaign;
        const tierCount =
          campaign?.relationships?.rewards?.data?.length ??
          data?.props?.pageProps?.rewards?.length ??
          null;
        return {
          name: attrs?.name ?? "",
          url,
          imageUrl: attrs?.image_url ?? attrs?.avatar_photo_url ?? null,
          blurb: attrs?.creation_name ?? stripTags(attrs?.summary ?? ""),
          category: DEFAULT_CATEGORY,
          patrons: attrs?.patron_count ?? null,
          tierCount,
          isNSFW: attrs?.is_nsfw ?? false,
          source: "patreon-lookup",
        };
      }
    } catch {
      // Fall through
    }
  }

  // OG tags fallback
  const name = extractMeta(html, "og:title").replace(" on Patreon", "").trim();
  const image = extractMeta(html, "og:image");
  const description = extractMeta(html, "og:description");

  if (!name) return null;
  return {
    name,
    url,
    imageUrl: image || null,
    blurb: description,
    category: DEFAULT_CATEGORY,
    patrons: null,
    tierCount: null,
    isNSFW: false,
    source: "patreon-lookup",
  };
}

/* ── Fetch helper ────────────────────────────────────────────── */

async function fetchPatreon(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; VLTDComicApp/1.0; +https://vaultd.app)",
      "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    next: { revalidate: 1800 },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/* ── GET handler ─────────────────────────────────────────────── */

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "comics";
  const creatorUrl = searchParams.get("url") ?? "";

  try {
    // Lookup mode — specific creator URL
    if (creatorUrl) {
      const safeUrl = creatorUrl.startsWith("https://www.patreon.com/")
        ? creatorUrl
        : `https://www.patreon.com/${creatorUrl.replace(/^\/+/, "")}`;
      const html = await fetchPatreon(safeUrl);
      const creator = parseLookupPage(html, safeUrl);
      if (!creator) {
        return NextResponse.json({ error: "Creator not found" }, { status: 404 });
      }
      return NextResponse.json({ creators: [creator], source: "patreon-lookup" });
    }

    // Search mode
    const searchUrl = `${PATREON_SEARCH}?q=${encodeURIComponent(q)}`;
    const html = await fetchPatreon(searchUrl);
    const creators = parseSearchPage(html, q);

    // Note: Patreon's search is heavily client-rendered. If we get 0 results,
    // the page may have loaded without the JSON bootstrap. We return what we have
    // and include a note so the UI can show a helpful message.
    return NextResponse.json({
      creators,
      source: "patreon-search",
      query: q,
      note:
        creators.length === 0
          ? "Patreon search results are client-rendered — try providing a direct creator URL instead."
          : undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Patreon fetch failed: ${msg}` },
      { status: 502 }
    );
  }
}
