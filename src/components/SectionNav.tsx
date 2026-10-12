"use client";

import { LocalNav } from "@/components/ui/LocalNav";

// Local navigation for the sections that hold several pages. Same pill recipe everywhere (see LocalNav).

const DISCOVER_ITEMS = [
  { key: "explore", label: "Explore", href: "/discover" },
  { key: "saved", label: "Saved", href: "/saved" },
  { key: "watchlist", label: "Watchlist", href: "/watchlist" },
  { key: "market", label: "Marketplace", href: "/market" },
  { key: "upcoming", label: "Upcoming Comics", href: "/upcoming" },
  { key: "events", label: "Events", href: "/events" },
];

const LOUNGE_ITEMS = [
  { key: "community", label: "Community", href: "/community-board" },
  { key: "learn", label: "Learn", href: "/learn" },
];

function Strip({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-[1480px] px-4 pb-3 pt-1 sm:px-6 lg:px-8">{children}</div>;
}

/** Discover: Explore, Saved, Watchlist, Marketplace, Upcoming Comics, Events. */
export function DiscoverNav({ activeKey }: { activeKey: "explore" | "saved" | "watchlist" | "market" | "upcoming" | "events" }) {
  return (
    <Strip>
      <LocalNav ariaLabel="Discover" items={DISCOVER_ITEMS} activeKey={activeKey} />
    </Strip>
  );
}

/** Lounge: Community and Learn. Learn is a section of Lounge, so it keeps this same navigation. */
export function LoungeNav({ activeKey }: { activeKey: "community" | "learn" }) {
  return (
    <Strip>
      <LocalNav ariaLabel="Lounge" items={LOUNGE_ITEMS} activeKey={activeKey} />
    </Strip>
  );
}

const VAULT_ITEMS = [
  { key: "items", label: "Items", href: "/vault" },
  { key: "for-sale", label: "For Sale", href: "/vault/for-sale" },
  { key: "sold", label: "Sold", href: "/vault/sold" },
];
const VAULT_TOOLS = [
  { key: "insights", label: "Insights", href: "/portfolio" },
  { key: "goals", label: "Goals", href: "/goals" },
];

/** Vault: Items, For Sale, Sold, then Insights and Goals. The same bar on every Vault page, so each one has a way back. */
export function VaultLocalNav({ activeKey }: { activeKey: "items" | "for-sale" | "sold" | "insights" | "goals" }) {
  return <LocalNav ariaLabel="Vault" items={VAULT_ITEMS} trailing={VAULT_TOOLS} activeKey={activeKey} />;
}

/** The Vault bar in the standard page strip, for pages that do not lay out their own container. */
export function VaultNav({ activeKey }: { activeKey: "items" | "for-sale" | "sold" | "insights" | "goals" }) {
  return (
    <Strip>
      <VaultLocalNav activeKey={activeKey} />
    </Strip>
  );
}
