// Path: src/lib/repo/vaultRepo.ts
import type { VaultItem } from "@/lib/vaultModel";
import { loadItems, saveItems } from "@/lib/vaultModel";

export type VaultRepoMode = "local" | "api";

export interface VaultRepo {
  list(): Promise<VaultItem[]>;
  upsertAll(items: VaultItem[]): Promise<void>;
  ensureSeed(seed: VaultItem[]): Promise<VaultItem[]>;
}

const LS_SEEDED_KEY = "vltd_vault_seeded_v1";

function normalizeId(id: any) {
  return String(id ?? "").trim();
}

function mergeById(existing: VaultItem[], incoming: VaultItem[]): VaultItem[] {
  const map = new Map<string, VaultItem>();

  for (const it of existing) {
    const id = normalizeId((it as any)?.id);
    if (!id) continue;
    map.set(id, it);
  }

  for (const it of incoming) {
    const id = normalizeId((it as any)?.id);
    if (!id) continue;

    const prev = map.get(id);
    // incoming overwrites previous (this is the "upsert" behavior)
    map.set(id, prev ? ({ ...prev, ...it } as VaultItem) : (it as VaultItem));
  }

  // Preserve a stable ordering:
  // - keep existing order first
  // - append truly new items at the end
  const out: VaultItem[] = [];
  const seen = new Set<string>();

  for (const it of existing) {
    const id = normalizeId((it as any)?.id);
    if (!id || seen.has(id)) continue;
    const v = map.get(id);
    if (v) {
      out.push(v);
      seen.add(id);
    }
  }

  for (const it of incoming) {
    const id = normalizeId((it as any)?.id);
    if (!id || seen.has(id)) continue;
    const v = map.get(id);
    if (v) {
      out.push(v);
      seen.add(id);
    }
  }

  // If any weirdness, fall back to map values
  if (out.length === 0 && map.size > 0) return Array.from(map.values());
  return out;
}

function safeArray(items: any): VaultItem[] {
  if (!Array.isArray(items)) return [];
  return items.filter(Boolean) as VaultItem[];
}

function getSeededFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(LS_SEEDED_KEY) === "1";
  } catch {
    return false;
  }
}

function setSeededFlag() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_SEEDED_KEY, "1");
  } catch {
    // ignore
  }
}

class LocalVaultRepo implements VaultRepo {
  async list() {
    return loadItems();
  }

  /**
   * ✅ Merge-protected upsertAll:
   * - Never overwrites the vault with only the incoming array.
   * - Updates existing items by id, adds new items, keeps the rest.
   */
  async upsertAll(items: VaultItem[]) {
    const incoming = safeArray(items);
    const existing = loadItems();

    // If someone mistakenly calls upsertAll([]), do nothing.
    if (incoming.length === 0) return;

    const merged = mergeById(existing, incoming);
    saveItems(merged);
  }

  /**
   * ✅ ensureSeed:
   * - If vault is empty: seed it.
   * - If vault exists but looks "accidentally overwritten" (ex: only 1 item),
   *   and seed hasn't been applied yet: merge seed items in without overwriting.
   * This helps restore demo items for testing after a bad upsertAll.
   */
  async ensureSeed(seed: VaultItem[]) {
    const existing = loadItems();
    const s = safeArray(seed);

    if (existing.length === 0) {
      saveItems(s);
      setSeededFlag();
      return s;
    }

    // Recovery mode: merge in seed once if not already seeded and vault is unusually small.
    const seeded = getSeededFlag();
    const looksOverwritten = existing.length > 0 && s.length > 0 && existing.length < Math.min(3, s.length);

    if (!seeded && looksOverwritten) {
      const merged = mergeById(existing, s);
      saveItems(merged);
      setSeededFlag();
      return merged;
    }

    return existing;
  }
}

class ApiVaultRepo implements VaultRepo {
  async list() {
    // Future: GET /api/vault
    const res = await fetch("/api/vault", { method: "GET" });
    if (!res.ok) throw new Error(`API list failed: ${res.status}`);
    return (await res.json()) as VaultItem[];
  }

  /**
   * API is assumed to be merge-safe server-side.
   * We still guard against accidental [] calls.
   */
  async upsertAll(items: VaultItem[]) {
    const incoming = safeArray(items);
    if (incoming.length === 0) return;

    // Future: POST /api/vault (server should merge by id)
    const res = await fetch("/api/vault", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: incoming, merge: true }),
    });
    if (!res.ok) throw new Error(`API upsertAll failed: ${res.status}`);
  }

  async ensureSeed(seed: VaultItem[]) {
    const existing = await this.list();
    if (existing.length > 0) return existing;

    // If empty, push seed once (optional)
    await this.upsertAll(seed);
    return seed;
  }
}

export function getVaultRepo(): VaultRepo {
  // Set NEXT_PUBLIC_VAULT_REPO=api when you’re ready.
  const mode = (process.env.NEXT_PUBLIC_VAULT_REPO ?? "local").toLowerCase() as VaultRepoMode;
  if (mode === "api") return new ApiVaultRepo();
  return new LocalVaultRepo();
}