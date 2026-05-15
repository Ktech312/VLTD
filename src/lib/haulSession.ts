import type { VaultItem } from "@/lib/vaultModel";

export type HaulItem = {
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

export type HaulSession = {
  id: string;
  name: string;
  startedAt: number;
  items: HaulItem[];
};

const HAUL_STORAGE_KEY = "vltd_haul_session_v1";

function todayName() {
  return `${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })} Haul`;
}

export function createHaulSession(): HaulSession {
  return {
    id: crypto.randomUUID(),
    name: todayName(),
    startedAt: Date.now(),
    items: [],
  };
}

export function loadHaulSession(): HaulSession | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(HAUL_STORAGE_KEY) || "null");
    if (!parsed?.id || !Array.isArray(parsed.items)) return null;
    return parsed as HaulSession;
  } catch {
    return null;
  }
}

export function saveHaulSession(session: HaulSession) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(HAUL_STORAGE_KEY, JSON.stringify(session));
}

export function clearHaulSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(HAUL_STORAGE_KEY);
}

export function addHaulItem(session: HaulSession, item: HaulItem): HaulSession {
  return { ...session, items: [...session.items, item] };
}

export function updateHaulItemStatus(
  session: HaulSession,
  itemId: string,
  status: HaulItem["status"]
): HaulSession {
  return {
    ...session,
    items: session.items.map((item) => (item.id === itemId ? { ...item, status } : item)),
  };
}

export function haulItemFromVaultItem(
  item: VaultItem,
  confidence?: "low" | "medium" | "high"
): HaulItem {
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

export function haulSessionStats(session: HaulSession) {
  const saved = session.items.filter((item) => item.status === "saved");
  const totalValue = saved.reduce((sum, item) => sum + (item.currentValue ?? 0), 0);
  return {
    count: saved.length,
    total: session.items.length,
    totalValue,
  };
}
