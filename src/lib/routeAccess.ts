// Which pages need what, decided in one place and enforced by RouteGuard (src/components/RouteGuard.tsx) on every navigation:
//   "public"  anyone, signed in or not (landing, login, sign-up, password recovery, email confirmation, Help, Discover and
//             the pages that are public on purpose: shared exhibitions, collector profiles, Learn, events, shop…)
//   "auth"    signed in; setup may still be unfinished (the onboarding page itself)
//   "setup"   signed in AND setup finished: the app proper (Home, Vault, Exhibitions, Lounge, Settings…)
// Anything not listed is public, so a new public page is never locked by accident.
// Signed out → login. Signed in with setup unfinished → onboarding. Setup finished → the page that was asked for.

export type RouteAccess = "public" | "auth" | "setup";

// App areas that need a finished account. Matches the signed-in areas listed in robots.ts, plus Lounge.
const SETUP_PREFIXES = [
  "/dashboard",
  "/vault",
  "/museum",
  "/community-board",
  "/lounge-preview",
  "/messages",
  "/notifications",
  "/portfolio",
  "/insurance",
  "/reports",
  "/sales",
  "/saved",
  "/favorites",
  "/goals",
  "/watchlist",
  "/account",
  "/capture",
  "/ingest",
  "/forge",
  "/redeem",
  "/auction",
  "/activity",
];

// Inside the app areas above, these stay public: shared and guest views of an exhibition.
function isPublicExhibitionView(path: string): boolean {
  return (
    path.startsWith("/museum/share/") ||
    path === "/museum/virtual-room/guest" ||
    /^\/museum\/[^/]+\/guest(\/|$)/.test(path)
  );
}

function matches(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(prefix + "/");
}

export function routeAccess(pathname: string | null | undefined): RouteAccess {
  const path = (pathname ?? "/").split("?")[0].split("#")[0].replace(/\/+$/, "") || "/";

  if (path === "/onboarding") return "auth";
  if (isPublicExhibitionView(path)) return "public";
  if (SETUP_PREFIXES.some((prefix) => matches(path, prefix))) return "setup";
  return "public";
}
