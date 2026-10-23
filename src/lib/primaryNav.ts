import type { AppIconName } from "@/components/ui/AppIcon";

/**
 * The five primary destinations, in the approved order. The top bar (768px and wider) and the
 * bottom bar (under 768px) both read this list, so they can never drift apart.
 * A destination stays highlighted for the pages that live inside it:
 * Insights and Goals sit in Vault, Learn sits in Lounge, and Marketplace, Upcoming Comics and Events
 * sit in Discover (reached from its Browse menu). Saved and Watchlist are personal lists, reached from the
 * Account menu, so they do not highlight Discover.
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
  { label: "Discover", href: "/discover", icon: "discover", match: ["/discover", "/market", "/upcoming", "/events"] },
];

export type BrowseKey = "discover" | "market" | "upcoming" | "events";

/** The Browse menu beside the title of the four public Discover pages. Each destination keeps its own page, title and URL. */
export const BROWSE_ITEMS: { key: BrowseKey; label: string; description: string; href: string }[] = [
  { key: "discover", label: "Public collections", description: "Explore public exhibitions and notable items", href: "/discover" },
  { key: "market", label: "Marketplace", description: "Collectibles for sale by collectors", href: "/market" },
  { key: "upcoming", label: "Upcoming Comics", description: "New releases by artist or series", href: "/upcoming" },
  { key: "events", label: "Events", description: "Conventions, card shows, auctions, drops", href: "/events" },
];

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
