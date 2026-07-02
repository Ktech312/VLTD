import { NextRequest, NextResponse } from "next/server";

// Only proxy images from known safe hosts (Supabase storage)
const ALLOWED_HOSTS = ["supabase.co", "supabase.in"];

function isAllowedHost(urlString: string): boolean {
  try {
    const { hostname } = new URL(urlString);
    return ALLOWED_HOSTS.some((h) => hostname.endsWith(h));
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");

  if (!url || !isAllowedHost(url)) {
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

    const contentType = upstream.headers.get("Content-Type") ?? "image/jpeg";
    const buffer = Buffer.from(await upstream.arrayBuffer());

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
