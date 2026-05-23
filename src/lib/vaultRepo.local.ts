// src/lib/vaultRepo.local.ts
import type { VaultRepo } from "./vaultRepo";
import { loadItems, saveItems, type VaultItem } from "./vaultModel";

export function createLocalVaultRepo(): VaultRepo {
  return {
    source: "local",
    async getAll() {
      return loadItems();
    },
    async upsertAll(items: VaultItem[]) {
      saveItems(items);
    },
    async upsertOne(item: VaultItem) {
      const all = loadItems();
      const next = [item, ...all.filter((x) => x.id !== item.id)];
      saveItems(next);
    },
    async remove(id: string) {
      const all = loadItems();
      saveItems(all.filter((x) => x.id !== id));
    },
  };
}