// src/app/insurance/packet/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { DEMO_ITEMS } from "@/lib/demoVault";
import { loadItemsOrSeed, type VaultItem as ModelItem } from "@/lib/vaultModel";
import { UNIVERSE_LABEL, type UniverseKey } from "@/lib/taxonomy";

type Item = ModelItem & {
  storageLocation?: string;
  certNumber?: string;
  serialNumber?: string;
  valueSource?: string;
  valueUpdatedAt?: number;
  valueConfidence?: number;
};

const LS_POLICY = "vltd_policy_packet_v1";

function clamp(n: number) {
  return Number.isFinite(n) ? n : 0;
}

// ✅ Accept undefined safely
function fmtMoney(n?: number | null) {
  const v = clamp(typeof n === "number" ? n : 0);
  const sign = v < 0 ? "-" : "";
  return `${sign}$${Math.abs(v).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  })}`;
}

function fmtDate(ms?: number) {
  if (!ms) return "";
  return new Date(ms).toLocaleDateString();
}

function itemUniverse(i: Item): UniverseKey {
  return (i.universe ?? "MISC") as UniverseKey;
}
function itemCategory(i: Item): string {
  return i.categoryLabel ?? "Collector’s Choice";
}
function itemSubcategory(i: Item): string | undefined {
  return i.subcategoryLabel;
}
function itemLabel(i: Item) {
  const u = UNIVERSE_LABEL[itemUniverse(i)];
  const c = itemCategory(i);
  const s = itemSubcategory(i);
  return s ? `${u} • ${c} • ${s}` : `${u} • ${c}`;
}

function toSeedItemsFromDemo(): Item[] {
  return (DEMO_ITEMS as any[]).map((d) => ({
    ...d,
    id: String(d.id),
    purchasePrice: Number(d.purchasePrice ?? 0),
    currentValue: Number(d.currentValue ?? 0),
    imageFrontUrl: d.imageFrontUrl ?? d.imageUrl,
  })) as Item[];
}

export default function InsurancePacketPage() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    const seed = toSeedItemsFromDemo();
    const loaded = loadItemsOrSeed(seed as any) as any as Item[];
    setItems(loaded);
  }, []);

  const totals = useMemo(() => {
    const cost = items.reduce((s, i) => s + clamp(Number(i.purchasePrice ?? 0)), 0);
    const value = items.reduce((s, i) => s + clamp(Number(i.currentValue ?? 0)), 0);
    return { cost, value };
  }, [items]);

  return (
    <main className="min-h-screen bg-white text-black">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .page-break { break-before: page; page-break-before: always; }
          img { break-inside: avoid; }
        }
      `}</style>

      <div className="mx-auto max-w-4xl p-6">
        <div className="no-print flex justify-between mb-6">
          <Link href="/insurance">← Back</Link>
          <button
            onClick={() => window.print()}
            className="bg-black text-white px-4 py-2 rounded-lg"
          >
            Print / Save as PDF
          </button>
        </div>

        <div>
          <h1 className="text-3xl font-semibold">Insurance Policy Packet</h1>
          <div className="mt-2 text-sm text-black/60">
            Generated {new Date().toLocaleString()} • Items {items.length} •
            Total Value {fmtMoney(totals.value)}
          </div>
        </div>

        {items.map((item) => (
          <div key={item.id} className="page-break mt-10">
            <div className="border border-black/10 p-6 rounded-xl">
              <div className="flex gap-6">
                {/* IMAGE */}
                <div className="w-48 shrink-0">
                  {item.imageFrontUrl ? (
                    <img
                      src={item.imageFrontUrl}
                      alt={item.title}
                      className="w-full h-auto rounded-lg border border-black/10"
                    />
                  ) : (
                    <div className="w-full h-64 bg-gray-200 flex items-center justify-center text-xs text-gray-500 rounded-lg">
                      No Image
                    </div>
                  )}
                </div>

                {/* DETAILS */}
                <div className="flex-1">
                  <h2 className="text-xl font-semibold">{item.title}</h2>
                  <div className="text-sm text-black/60 mt-1">
                    {itemLabel(item)}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div><strong>Grade:</strong> {item.grade ?? "-"}</div>
                      <div><strong>Cert #:</strong> {item.certNumber ?? "-"}</div>
                      <div><strong>Serial #:</strong> {item.serialNumber ?? "-"}</div>
                    </div>
                    <div>
                      <div><strong>Storage:</strong> {item.storageLocation ?? "-"}</div>
                      <div><strong>Cost:</strong> {fmtMoney(item.purchasePrice)}</div>
                      <div><strong>Value:</strong> {fmtMoney(item.currentValue)}</div>
                    </div>
                  </div>

                  {item.valueSource && (
                    <div className="mt-4 text-xs text-black/60">
                      Source: {item.valueSource} • Updated{" "}
                      {fmtDate(item.valueUpdatedAt)} • Confidence{" "}
                      {item.valueConfidence ?? 0}%
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}