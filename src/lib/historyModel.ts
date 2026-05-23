import { newId } from "@/lib/id";
import type { SaleRecord } from "@/types/vaultLifecycle";

const LS_KEY = "vltd_sale_history_v1";

function loadRaw(): SaleRecord[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed;
  } catch {
    return [];
  }
}

export function loadSaleHistory(): SaleRecord[] {
  return loadRaw();
}

export function saveSaleHistory(records: SaleRecord[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(records));
  } catch {
    // ignore
  }
}

export function addSaleRecord(record: Omit<SaleRecord, "id">) {
  const history = loadRaw();

  const next: SaleRecord = {
    id: newId(),
    ...record,
  };

  saveSaleHistory([next, ...history]);
}