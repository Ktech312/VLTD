"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import StreamDisplay from "@/components/StreamDisplay";
import { loadItems, type VaultItem } from "@/lib/vaultModel";

export default function PresentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [item, setItem] = useState<VaultItem | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      const items = loadItems();
      setItem(items.find((entry) => entry.id === id) ?? null);
    });
  }, [id]);

  if (!item) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black">
        <div className="text-sm text-white/40">Loading...</div>
      </div>
    );
  }

  return <StreamDisplay item={item} onClose={() => router.back()} />;
}
