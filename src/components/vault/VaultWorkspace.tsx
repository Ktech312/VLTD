"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";

import { PageHeader } from "@/components/layout/PageHeader";
import { VaultLocalNav } from "@/components/SectionNav";

type TabKey = "items" | "for-sale" | "sold" | "insights" | "goals" | "insurance";

// The five Vault tabs. They share ONE header and ONE tab row that stay mounted while you move between them (this component
// sits in NavShell, outside the per-route content that remounts), so switching tabs changes only what is under the tab row.
const TABS: { path: string; key: TabKey; description: string; also?: string[] }[] = [
  { path: "/vault", key: "items", description: "Every item you own, documented and searchable." },
  { path: "/vault/for-sale", key: "for-sale", description: "Per-platform listing readiness for the items you are selling." },
  { path: "/vault/sold", key: "sold", description: "Realized sales history." },
  { path: "/portfolio", key: "insights", description: "Know what your vault is worth and why." },
  { path: "/goals", key: "goals", description: "Turn a collection into a plan." },
  // Insurance: the inventory, each item's sheet and the policy packet all live under this one tab. The print-only page stays outside the shell.
  { path: "/insurance", key: "insurance", description: "Your records for a policy. Documentation readiness is not insurance coverage.", also: ["/insurance/item", "/insurance/packet"] },
];

const WorkspaceContext = createContext<{ slot: HTMLElement | null } | null>(null);

export function tabForPath(pathname: string | null | undefined) {
  const path = (pathname ?? "").split("?")[0].replace(/\/+$/, "") || "/";
  return TABS.find((t) => t.path === path || t.also?.includes(path)) ?? null;
}

/** True on a page that is currently drawn inside the Vault workspace (so it must not draw its own header or tab row). */
export function useInVaultWorkspace() {
  return useContext(WorkspaceContext) !== null;
}

/**
 * Each tab's own header buttons (Add Item, Create Goal, Sales History…). The page keeps the buttons and their handlers; they are
 * drawn in the shared header's action area, so state stays with the page and only the buttons change when the tab changes.
 */
export function WorkspaceActions({ children }: { children: ReactNode }) {
  const ctx = useContext(WorkspaceContext);
  if (!ctx || !ctx.slot) return null;
  return createPortal(children, ctx.slot);
}

export default function VaultWorkspace({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const tab = tabForPath(pathname);
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  if (!tab) return <>{children}</>;

  return (
    <WorkspaceContext.Provider value={{ slot }}>
      <div data-vault-workspace={tab.key}>
        <div data-vault-chrome="true">
        <PageHeader
          title="Vault"
          description={tab.description}
          contentClassName="max-w-[1480px]"
          actions={<div ref={setSlot} className="contents" data-workspace-actions />}
        />
        <div className="mx-auto w-full max-w-[1480px] px-4 pb-3 pt-1 sm:px-6 lg:px-8">
          <VaultLocalNav activeKey={tab.key} />
        </div>
        </div>
        {children}
      </div>
    </WorkspaceContext.Provider>
  );
}
