import type { AppIconName } from "@/components/ui/AppIcon";

/**
 * Navigation has two arrangements that read this file:
 *  - DESKTOP (768px and wider, the top bar): Home, Vault, Exhibitions, Insights and a More menu (Discover, Events, VLT Lounge, Activity, Learn).
 *  - PHONE (under 768px, the bottom bar): PRIMARY_NAV below, unchanged while the phone arrangement is reviewed. Every destination in More is
 *    still reachable on a phone (Discover and Lounge are tabs; Insights, Goals and Insurance are in the Vault bar; Events and Upcoming Comics
 *    are sections on Discover; Learn is in the Lounge bar; Activity is on Home).
 * Saved and Watchlist are personal lists, reached from the Account menu and from the shortcuts beside Discover's search, so they highlight nothing.
 */
export type PrimaryNavItem = {
  label: string;
  href: string;
  icon: AppIconName;
  /** Paths that keep this destination highlighted. */
  match: string[];
  /** Highlight only on an exact match (Home). */
  exactOnly?: boolean;
};

export const PRIMARY_NAV: PrimaryNavItem[] = [
  { label: "Home", href: "/dashboard", icon: "dashboard", match: ["/dashboard"], exactOnly: true },
  { label: "Vault", href: "/vault", icon: "vault", match: ["/vault", "/portfolio", "/goals", "/insurance"] },
  { label: "Exhibitions", href: "/museum", icon: "exhibitions", match: ["/museum"] },
  { label: "Lounge", href: "/community-board", icon: "communityBoard", match: ["/community-board", "/learn"] },
  { label: "Discover", href: "/discover", icon: "discover", match: ["/discover", "/market", "/shop", "/upcoming", "/kickstarter", "/patreon", "/events"] },
];

/** The desktop top bar's direct links. Insights is a direct link here (its page is still /portfolio and it is still in the Vault bar). */
export const DESKTOP_NAV: PrimaryNavItem[] = [
  { label: "Home", href: "/dashboard", icon: "dashboard", match: ["/dashboard"], exactOnly: true },
  { label: "Vault", href: "/vault", icon: "vault", match: ["/vault", "/goals", "/insurance"] },
  { label: "Exhibitions", href: "/museum", icon: "exhibitions", match: ["/museum"] },
  { label: "Insights", href: "/portfolio", icon: "insights", match: ["/portfolio"] },
];

export type MoreItem = { key: string; label: string; description: string; href: string; match: string[]; signedInOnly?: boolean };

/** The desktop More menu. Marketplace and Upcoming Comics are Discover sections, so they keep More (Discover) highlighted; so do the pages they link to (Collector supplies & services, Kickstarter and Patreon comics). */
export const MORE_ITEMS: MoreItem[] = [
  { key: "discover", label: "Discover", description: "Public collections, notable items and collectors", href: "/discover", match: ["/discover", "/market", "/shop", "/upcoming", "/kickstarter", "/patreon"] },
  { key: "events", label: "Events", description: "Conventions, card shows, auctions and drops", href: "/events", match: ["/events"] },
  { key: "lounge", label: "VLT Lounge", description: "Community board and leaderboards", href: "/community-board", match: ["/community-board"] },
  { key: "activity", label: "Activity", description: "Everything that changed in your vault", href: "/activity", match: ["/activity"], signedInOnly: true },
  { key: "learn", label: "Learn", description: "Guides and learning", href: "/learn", match: ["/learn"] },
];

const pathMatches = (path: string, prefixes: string[]) => prefixes.some((prefix) => path === prefix || path.startsWith(prefix + "/"));

/** Which More entry the page belongs to (null when it is not one of them). */
export function activeMoreKey(pathname: string): string | null {
  const path = pathname || "";
  return MORE_ITEMS.find((item) => pathMatches(path, item.match))?.key ?? null;
}

/** Direct entries at the top of the Account menu's links, on every page. Personal lists: not part of Discover. */
export const ACCOUNT_SHORTCUTS: { key: string; label: string; href: string }[] = [
  { key: "saved", label: "Saved", href: "/saved" },
  { key: "watchlist", label: "Watchlist", href: "/watchlist" },
];

export function isPrimaryNavActive(item: PrimaryNavItem, pathname: string): boolean {
  const path = pathname || "";
  if (item.exactOnly) {
    // The signed-in home is /dashboard; "/" is the same place for a signed-in person.
    return path === item.href || path === "/";
  }
  return item.match.some((prefix) => path === prefix || path.startsWith(prefix + "/"));
}

/** Pages where the persistent mobile Add Item action is shown: the main pages of the five destinations. */
const ADD_ITEM_ROUTES = [
  "/dashboard",
  "/vault",
  "/portfolio",
  "/goals",
  "/museum",
  "/community-board",
  "/learn",
  "/discover",
  "/saved",
  "/watchlist",
  "/market",
  "/upcoming",
  "/events",
];

/** Add flows and detail pages already have their own actions, so the persistent action stays out of their way. */
const ADD_ITEM_HIDDEN_PREFIXES = [
  "/vault/add",
  "/vault/quick",
  "/vault/bulk",
  "/vault/import",
  "/vault/item",
  "/vault/print",
  "/vault/halls",
  "/museum/new",
  "/museum/builder",
  "/museum/vltd",
  "/museum/virtual-room",
  "/museum/campus-prototype",
];

export function showMobileAddItem(pathname: string): boolean {
  const path = pathname || "";
  if (ADD_ITEM_HIDDEN_PREFIXES.some((p) => path === p || path.startsWith(p + "/"))) return false;
  // Gallery pages like /museum/<id> are detail pages.
  if (/^\/museum\/[^/]+/.test(path)) return false;
  return ADD_ITEM_ROUTES.some((p) => path === p || path.startsWith(p + "/"));
}
