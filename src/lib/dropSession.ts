import type { VaultItem } from "@/lib/vaultModel";

export type DropItem = {
  id: string;
  title: string;
  subtitle?: string;
  universe?: string;
  categoryLabel?: string;
  grade?: string;
  currentValue?: number;
  imageFrontUrl?: string;
  scanConfidence?: "low" | "medium" | "high";
  status: "saved" | "skipped";
  addedAt: number;
};

export type DropSession = {
  id: string;
  name: string;
  startedAt: number;
  items: DropItem[];
};

const DROP_STORAGE_KEY = "vltd_drop_session_v1";

function todayName() {
  return `${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })} Drop`;
}

export function createDropSession(): DropSession {
  return {
    id: crypto.randomUUID(),
    name: todayName(),
    startedAt: Date.now(),
    items: [],
  };
}

export function loadDropSession(): DropSession | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(DROP_STORAGE_KEY) || "null");
    if (!parsed?.id || !Array.isArray(parsed.items)) return null;
    return parsed as DropSession;
  } catch {
    return null;
  }
}

export function saveDropSession(session: DropSession) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DROP_STORAGE_KEY, JSON.stringify(session));
}

export function clearDropSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(DROP_STORAGE_KEY);
}

export function addDropItem(session: DropSession, item: DropItem): DropSession {
  return { ...session, items: [...session.items, item] };
}

export function updateDropItemStatus(
  session: DropSession,
  itemId: string,
  status: DropItem["status"]
): DropSession {
  return {
    ...session,
    items: session.items.map((item) => (item.id === itemId ? { ...item, status } : item)),
  };
}

export function dropItemFromVaultItem(
  item: VaultItem,
  confidence?: "low" | "medium" | "high"
): DropItem {
  return {
    id: item.id,
    title: item.title,
    subtitle: item.subtitle,
    universe: item.universe,
    categoryLabel: item.categoryLabel,
    grade: item.grade,
    currentValue: item.currentValue,
    imageFrontUrl: item.imageFrontUrl,
    scanConfidence: confidence,
    status: "saved",
    addedAt: Date.now(),
  };
}

export function dropSessionStats(session: DropSession) {
  const saved = session.items.filter((item) => item.status === "saved");
  const totalValue = saved.reduce((sum, item) => sum + (item.currentValue ?? 0), 0);
  return {
    count: saved.length,
    total: session.items.length,
    totalValue,
  };
}
