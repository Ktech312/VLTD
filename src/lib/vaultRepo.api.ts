// src/lib/vaultRepo.api.ts
import type { VaultRepo } from "./vaultRepo";
import type { VaultItem } from "./vaultModel";

const BASE = "/api/vault";

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`API ${res.status}`);
  return (await res.json()) as T;
}

export function createApiVaultRepo(): VaultRepo {
  return {
    source: "api",
    async getAll() {
      return j<VaultItem[]>(await fetch(BASE, { cache: "no-store" }));
    },
    async upsertAll(items: VaultItem[]) {
      await j(await fetch(BASE, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items }) }));
    },
    async upsertOne(item: VaultItem) {
      await j(await fetch(`${BASE}/${encodeURIComponent(item.id)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ item }) }));
    },
    async remove(id: string) {
      await j(await fetch(`${BASE}/${encodeURIComponent(id)}`, { method: "DELETE" }));
    },
  };
}