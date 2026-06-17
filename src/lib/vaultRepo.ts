// src/lib/vaultRepo.ts
import type { VaultItem } from "./vaultModel";

export type VaultRepoSource = "local" | "api";

export interface VaultRepo {
  source: VaultRepoSource;
  getAll(): Promise<VaultItem[]>;
  upsertAll(items: VaultItem[]): Promise<void>;
  upsertOne(item: VaultItem): Promise<void>;
  remove(id: string): Promise<void>;
}