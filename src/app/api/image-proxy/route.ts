import { NextRequest, NextResponse } from "next/server";

// Only proxy images from known hosts: our own storage, plus the marketplaces
// imported photos are linked from (so Edit Photo / Remove BG can read them;
// browsers block reading those images directly). Matches the exact host or a
// subdomain of it -- never a lookalike such as "evilsupabase.co".
const ALLOWED_HOSTS = [
  "supabase.co",
  "supabase.in",
  "ebayimg.com",
  "whatnot.com",
  "celebrityauthenticsauctions.com",
  "pristineauction.com",
];

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_REDIRECTS = 3;

function isAllowedUrl(urlString: string): boolean {
  try {
    const { protocol, hostname } = new URL(urlString);
    if (protocol !== "https:") return false;
    const host = hostname.toLowerCase();
    return ALLOWED_HOSTS.some((allowed) => host === allowed || host.endsWith("." + allowed));
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");

  if (!url || !isAllowedUrl(url)) {
    return new NextResponse(null, { status: 400 });
  }

  try {
    // Redirects are followed by hand, a few at a time: every destination is checked BEFORE it is requested, so a redirect to a host
    // outside the allowed list (or to a plain-http / internal address) is never contacted.
    let current = url;
    let upstream: Response | null = null;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const res: Response = await fetch(current, {
        redirect: "manual",
        // Let Vercel edge cache the image
        next: { revalidate: 3600 },
      });
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) return new NextResponse(null, { status: 502 });
        let next: string;
        try {
          next = new URL(location, current).toString();
        } catch {
          return new NextResponse(null, { status: 400 });
        }
        if (!isAllowedUrl(next)) return new NextResponse(null, { status: 400 });
        current = next;
        continue;
      }
      upstream = res;
      break;
    }
    if (!upstream) return new NextResponse(null, { status: 508 });

    if (!upstream.ok) {
      return new NextResponse(null, { status: upstream.status });
    }

    const contentType = upstream.headers.get("Content-Type") ?? "image/jpeg";
    if (!contentType.toLowerCase().startsWith("image/")) {
      return new NextResponse(null, { status: 415 });
    }

    const declared = Number(upstream.headers.get("Content-Length") ?? 0);
    if (declared > MAX_BYTES) {
      return new NextResponse(null, { status: 413 });
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    if (buffer.length > MAX_BYTES) {
      return new NextResponse(null, { status: 413 });
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        // Allow any origin so canvas drawImage works cross-origin
        "Access-Control-Allow-Origin": "*",
        // Cache aggressively — images don't change at their storage paths
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}
