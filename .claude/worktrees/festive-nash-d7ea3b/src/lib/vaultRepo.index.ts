// src/lib/vaultRepo.index.ts
import type { VaultRepoSource } from "./vaultRepo";
import { createLocalVaultRepo } from "./vaultRepo.local";
import { createApiVaultRepo } from "./vaultRepo.api";

export function getVaultRepo() {
  const src = (process.env.NEXT_PUBLIC_VLTD_DATA_SOURCE ?? "local") as VaultRepoSource;
  return src === "api" ? createApiVaultRepo() : createLocalVaultRepo();
}