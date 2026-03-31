import { loadGalleries, type Gallery } from "@/lib/galleryModel";
import { loadItems, type VaultItem } from "@/lib/vaultModel";

export type CommandSection =
  | "navigation"
  | "vault"
  | "museum"
  | "portfolio"
  | "account"
  | "action";

export type CommandItem = {
  id: string;
  label: string;
  subtitle?: string;
  href?: string;
  section: CommandSection;
  keywords?: string[];
  action?:
    | { type: "switch-profile"; profileId: string }
    | { type: "none" };
};

export type CommandProfile = {
  id: string;
  username: string;
  display_name: string;
  profile_type: "personal" | "business";
};

const ACTIVE_PROFILE_KEY = "vltd_active_profile_id_v1";
const ACTIVE_PROFILE_EVENT = "vltd:active-profile";

function safeNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function itemValue(item: VaultItem) {
  return safeNumber(item.currentValue);
}

function itemCost(item: VaultItem) {
  return (
    safeNumber(item.purchasePrice) +
    safeNumber(item.purchaseTax) +
    safeNumber(item.purchaseShipping) +
    safeNumber(item.purchaseFees)
  );
}

function itemProfit(item: VaultItem) {
  return itemValue(item) - itemCost(item);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function scoreCommand(command: CommandItem, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return 1;

  const haystack = [
    command.label,
    command.subtitle ?? "",
    ...(command.keywords ?? []),
    command.section,
  ]
    .join(" ")
    .toLowerCase();

  if (haystack === q) return 100;
  if (command.label.toLowerCase().startsWith(q)) return 80;
  if (haystack.includes(q)) return 50;

  const parts = q.split(/\s+/).filter(Boolean);
  if (parts.length > 1 && parts.every((part) => haystack.includes(part))) return 30;

  return 0;
}

function getGalleryItemsValue(gallery: Gallery, itemsById: Map<string, VaultItem>) {
  return gallery.itemIds.reduce((sum, itemId) => {
    const item = itemsById.get(itemId);
    return sum + (item ? itemValue(item) : 0);
  }, 0);
}

export function getBaseCommands(): CommandItem[] {
  return [
    {
      id: "nav_home",
      label: "Go to Home",
      subtitle: "Return to the main dashboard",
      href: "/",
      section: "navigation",
      keywords: ["dashboard", "home", "main"],
    },
    {
      id: "nav_vault",
      label: "Open Vault Inventory",
      subtitle: "Browse your active profile inventory",
      href: "/vault",
      section: "vault",
      keywords: ["vault", "inventory", "items", "collection"],
    },
    {
      id: "nav_quick_add",
      label: "Quick Add Item",
      subtitle: "Add a new item to the vault",
      href: "/vault/quick",
      section: "action",
      keywords: ["add item", "quick add", "new item", "vault add"],
    },
    {
      id: "nav_museum",
      label: "Open Museum",
      subtitle: "View and manage curated galleries",
      href: "/museum",
      section: "museum",
      keywords: ["museum", "galleries", "gallery", "exhibitions"],
    },
    {
      id: "nav_new_gallery",
      label: "Create Gallery",
      subtitle: "Start a new curated museum gallery",
      href: "/museum/new",
      section: "action",
      keywords: ["new gallery", "add gallery", "museum create", "exhibition"],
    },
    {
      id: "nav_portfolio",
      label: "Open Portfolio",
      subtitle: "View portfolio metrics and valuation",
      href: "/portfolio",
      section: "portfolio",
      keywords: ["portfolio", "roi", "value", "valuation", "metrics"],
    },
    {
      id: "nav_collector",
      label: "Open Collector Profile",
      subtitle: "See the public-style collector overview",
      href: "/collector",
      section: "account",
      keywords: ["collector", "profile", "identity"],
    },
    {
      id: "nav_account",
      label: "Open Account Center",
      subtitle: "Manage account and profiles",
      href: "/account",
      section: "account",
      keywords: ["account", "settings", "profiles", "login"],
    },
  ];
}

function getProductivityCommands(
  items: VaultItem[],
  galleries: Gallery[]
): CommandItem[] {
  const itemsById = new Map(items.map((item) => [item.id, item]));

  const highestValueItem = [...items].sort((a, b) => itemValue(b) - itemValue(a))[0];
  const bestPerformingItem = [...items].sort((a, b) => itemProfit(b) - itemProfit(a))[0];
  const mostUnderwaterItem = [...items].sort((a, b) => itemProfit(a) - itemProfit(b))[0];

  const topGalleryByViews = [...galleries].sort(
    (a, b) => safeNumber(b.analytics?.views) - safeNumber(a.analytics?.views)
  )[0];

  const largestGallery = [...galleries].sort(
    (a, b) => b.itemIds.length - a.itemIds.length
  )[0];

  const mostValuableGallery = [...galleries].sort(
    (a, b) => getGalleryItemsValue(b, itemsById) - getGalleryItemsValue(a, itemsById)
  )[0];

  const commands: CommandItem[] = [];

  if (highestValueItem) {
    commands.push({
      id: "action_highest_value_item",
      label: "Open Highest Value Item",
      subtitle: `${highestValueItem.title} • ${formatMoney(itemValue(highestValueItem))}`,
      href: `/vault?q=${encodeURIComponent(highestValueItem.title ?? "")}`,
      section: "action",
      keywords: ["highest value", "top item", "best value", "most valuable item"],
    });
  }

  if (bestPerformingItem) {
    commands.push({
      id: "action_best_performing_item",
      label: "Open Best Performing Item",
      subtitle: `${bestPerformingItem.title} • ${itemProfit(bestPerformingItem) >= 0 ? "+" : ""}${formatMoney(itemProfit(bestPerformingItem))}`,
      href: `/vault?q=${encodeURIComponent(bestPerformingItem.title ?? "")}`,
      section: "action",
      keywords: ["best performing", "top performer", "highest gain", "best roi item"],
    });
  }

  if (mostUnderwaterItem) {
    commands.push({
      id: "action_most_underwater_item",
      label: "Open Most Underwater Item",
      subtitle: `${mostUnderwaterItem.title} • ${itemProfit(mostUnderwaterItem) >= 0 ? "+" : ""}${formatMoney(itemProfit(mostUnderwaterItem))}`,
      href: `/vault?q=${encodeURIComponent(mostUnderwaterItem.title ?? "")}`,
      section: "action",
      keywords: ["underwater", "worst item", "largest loss", "biggest loser"],
    });
  }

  if (topGalleryByViews) {
    commands.push({
      id: "action_top_gallery_views",
      label: "Open Top Gallery by Views",
      subtitle: `${topGalleryByViews.title} • ${safeNumber(topGalleryByViews.analytics?.views)} views`,
      href: `/museum/${topGalleryByViews.id}`,
      section: "action",
      keywords: ["top gallery", "most viewed gallery", "views", "popular gallery"],
    });
  }

  if (largestGallery) {
    commands.push({
      id: "action_largest_gallery",
      label: "Open Largest Gallery",
      subtitle: `${largestGallery.title} • ${largestGallery.itemIds.length} items`,
      href: `/museum/${largestGallery.id}`,
      section: "action",
      keywords: ["largest gallery", "most items", "biggest exhibition"],
    });
  }

  if (mostValuableGallery) {
    commands.push({
      id: "action_most_valuable_gallery",
      label: "Open Most Valuable Gallery",
      subtitle: `${mostValuableGallery.title} • ${formatMoney(getGalleryItemsValue(mostValuableGallery, itemsById))}`,
      href: `/museum/${mostValuableGallery.id}`,
      section: "action",
      keywords: ["most valuable gallery", "top value gallery", "best gallery value"],
    });
  }

  return commands;
}

function getGalleryCommands(galleries: Gallery[]): CommandItem[] {
  return galleries.map((gallery) => ({
    id: `gallery_${gallery.id}`,
    label: gallery.title?.trim() || "Untitled Gallery",
    subtitle: `${gallery.itemIds.length} items • ${gallery.visibility} gallery`,
    href: `/museum/${gallery.id}`,
    section: "museum",
    keywords: [
      "gallery",
      "museum",
      gallery.description ?? "",
      gallery.visibility ?? "",
      gallery.state ?? "",
      ...(gallery.itemIds ?? []),
    ],
  }));
}

function getItemCommands(items: VaultItem[]): CommandItem[] {
  const sorted = [...items]
    .sort((a, b) => itemValue(b) - itemValue(a))
    .slice(0, 24);

  return sorted.map((item) => {
    const value = itemValue(item);
    const cost = itemCost(item);
    const profit = value - cost;

    return {
      id: `item_${item.id}`,
      label: item.title?.trim() || "Untitled Item",
      subtitle: `${formatMoney(value)} value${cost > 0 ? ` • ${profit >= 0 ? "+" : ""}${formatMoney(profit)}` : ""}`,
      href: `/vault?q=${encodeURIComponent(item.title ?? "")}`,
      section: "vault",
      keywords: [
        "item",
        "vault",
        item.title ?? "",
        item.subtitle ?? "",
        item.number ?? "",
        item.grade ?? "",
        item.category ?? "",
        item.categoryLabel ?? "",
        item.subcategoryLabel ?? "",
        item.universe ?? "",
        item.purchaseSource ?? "",
        item.storageLocation ?? "",
      ],
    };
  });
}

function getProfileCommands(
  profiles: CommandProfile[],
  activeProfileId?: string
): CommandItem[] {
  return profiles.map((profile) => {
    const active = profile.id === activeProfileId;

    return {
      id: `profile_${profile.id}`,
      label: active
        ? `Active: ${profile.display_name}`
        : `Switch to ${profile.display_name}`,
      subtitle: `@${profile.username} • ${profile.profile_type === "business" ? "Business" : "Personal"} profile`,
      section: "account",
      keywords: [
        "profile",
        "switch profile",
        profile.display_name,
        profile.username,
        profile.profile_type,
        active ? "active current selected" : "switch change",
      ],
      action: { type: "switch-profile", profileId: profile.id },
    };
  });
}

export function getAllCommands(args?: {
  profiles?: CommandProfile[];
  activeProfileId?: string;
}): CommandItem[] {
  const items = loadItems();
  const galleries = loadGalleries();

  const base = getBaseCommands();
  const productivity = getProductivityCommands(items, galleries);
  const profiles = getProfileCommands(args?.profiles ?? [], args?.activeProfileId);
  const galleryCommands = getGalleryCommands(galleries);
  const itemCommands = getItemCommands(items);

  return [...base, ...productivity, ...profiles, ...galleryCommands, ...itemCommands];
}

export function searchCommands(commands: CommandItem[], query: string): CommandItem[] {
  const q = query.trim();
  if (!q) return commands;

  return [...commands]
    .map((command) => ({
      command,
      score: scoreCommand(command, q),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.command.label.localeCompare(b.command.label))
    .map((entry) => entry.command);
}

export function groupCommands(commands: CommandItem[]) {
  const groups: Record<CommandSection, CommandItem[]> = {
    navigation: [],
    vault: [],
    museum: [],
    portfolio: [],
    account: [],
    action: [],
  };

  for (const command of commands) {
    groups[command.section].push(command);
  }

  return groups;
}

export function runCommandAction(command: CommandItem) {
  if (!command.action) return false;

  if (command.action.type === "switch-profile") {
    if (typeof window === "undefined") return false;
    window.localStorage.setItem(ACTIVE_PROFILE_KEY, command.action.profileId);
    window.dispatchEvent(new Event(ACTIVE_PROFILE_EVENT));
    return true;
  }

  return false;
}