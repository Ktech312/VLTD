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
    const upstream = await fetch(url, {
      // Let Vercel edge cache the image
      next: { revalidate: 3600 },
    });

    if (!upstream.ok) {
      return new NextResponse(null, { status: upstream.status });
    }

    // A redirect must not take us somewhere outside the allowed hosts.
    if (upstream.url && !isAllowedUrl(upstream.url)) {
      return new NextResponse(null, { status: 400 });
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
