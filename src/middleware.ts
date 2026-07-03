import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Rewrite /@username → /u/username (URL stays /@username in the browser)
  const match = pathname.match(/^\/@([a-zA-Z0-9_]{1,30})\/?$/);
  if (match) {
    const url = request.nextUrl.clone();
    url.pathname = `/u/${match[1].toLowerCase()}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  // Run on all paths except static files and Next.js internals
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|api/).*)"],
};
