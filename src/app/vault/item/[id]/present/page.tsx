"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import StreamDisplay from "@/components/StreamDisplay";
import { PillButton } from "@/components/ui/PillButton";
import { LoadErrorCard, useCloudRefresh } from "@/components/vault/CloudStatus";
import { loadItems, type VaultItem } from "@/lib/vaultModel";

export default function PresentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [item, setItem] = useState<VaultItem | null>(null);
  const reloadRef = useRef<() => void>(() => undefined);
  // The item is looked up on this device first, then in the account. "Not in your vault" is only said once the account has answered.
  const cloud = useCloudRefresh(() => reloadRef.current());

  useEffect(() => {
    const reload = () => setItem(loadItems().find((entry) => entry.id === id) ?? null);
    reloadRef.current = reload;
    queueMicrotask(reload);
  }, [id]);

  if (!item) {
    if (cloud.state === "ok") {
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-black px-4">
          <div role="alert" data-testid="present-not-found" className="max-w-sm rounded-[10px] p-6 text-center ring-1 ring-white/15">
            <div className="text-base font-semibold text-white">That item isn&apos;t in your vault</div>
            <p className="mt-1 text-sm text-white/60">The link may be wrong, or the item belongs to someone else.</p>
            <div className="mt-4 flex justify-center"><PillButton href="/vault">Back to the Vault</PillButton></div>
          </div>
        </div>
      );
    }
    if (cloud.state === "failed") {
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-black px-4">
          <div className="w-full max-w-md"><LoadErrorCard what="item" onRetry={cloud.retry} busy={cloud.busy} /></div>
        </div>
      );
    }
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black">
        <div className="text-sm text-white/40">Loading...</div>
      </div>
    );
  }

  return <StreamDisplay item={item} onClose={() => router.back()} />;
}
