// Path: src/app/vault/VaultClient.tsx
"use client";

import VaultInner from "./VaultInner";

/**
 * Compat wrapper:
 * - Keep the old import path stable for /vault/page.tsx (Suspense wrapper)
 * - Actual implementation lives in VaultInner.tsx
 */
export default function VaultClient() {
  return <VaultInner />;
}