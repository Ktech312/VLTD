// src/app/insurance/item/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

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

function clamp(n: number) {
  return Number.isFinite(n) ? n : 0;
}
function fmtMoney(n: number) {
  const v = clamp(n);
  const sign = v < 0 ? "-" : "";
  return `${sign}$${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}
function fmtDate(ms?: number) {
  if (!ms) return "";
  try {
    return new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
  } catch {
    return "";
  }
}

function toSeedItemsFromDemo(): Item[] {
  return (DEMO_ITEMS as any[]).map((d) => ({
    id: String(d.id),
    category: d.category,
    customCategoryLabel: d.customCategoryLabel,
    title: d.title,
    subtitle: d.subtitle,
    number: d.number,
    grade: d.grade,
    purchasePrice: Number(d.purchasePrice ?? 0),
    currentValue: Number(d.currentValue ?? 0),
    imageFrontUrl: d.imageFrontUrl ?? d.imageUrl,
    imageBackUrl: d.imageBackUrl,
    notes: d.notes ?? "",
    universe: d.universe,
    categoryLabel: d.categoryLabel,
    subcategoryLabel: d.subcategoryLabel,

    storageLocation: d.storageLocation,
    certNumber: d.certNumber,
    serialNumber: d.serialNumber,

    valueSource: d.valueSource,
    valueUpdatedAt: d.valueUpdatedAt,
    valueConfidence: d.valueConfidence,
  })) as Item[];
}

function itemUniverse(i: Item): UniverseKey {
  return (i.universe ?? "MISC") as UniverseKey;
}
function itemCategory(i: Item): string {
  return i.categoryLabel ?? (i.category === "CUSTOM" ? i.customCategoryLabel ?? "Collector’s Choice" : "Collector’s Choice");
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

export default function InsuranceItemPage() {
  const sp = useSearchParams();
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    const seed = toSeedItemsFromDemo();
    const loaded = loadItemsOrSeed(seed as any) as any as Item[];
    setItems(loaded);
  }, []);

  const id = sp.get("id") ?? "";
  const item = useMemo(() => items.find((x) => String(x.id) === String(id)), [items, id]);

  return (
    <main className="min-h-screen bg-white text-black">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .card { box-shadow: none !important; border: 1px solid #ddd !important; }
        }
      `}</style>

      <div className="mx-auto max-w-3xl p-6">
        <div className="no-print flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link href="/insurance" className="rounded-lg border border-black/15 px-3 py-2 text-sm">
              ← Back to Report
            </Link>
            <Link href="/vault" className="rounded-lg border border-black/15 px-3 py-2 text-sm">
              Vault
            </Link>
          </div>
          <button onClick={() => window.print()} className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white">
            Print / Save as PDF
          </button>
        </div>

        <div className="mt-6 card rounded-2xl border border-black/10 p-6">
          <div className="text-xs tracking-widest text-black/50">INSURANCE ITEM SHEET</div>

          {!item ? (
            <div className="mt-4 text-black/70">Item not found. Go back and open a per-item sheet from the report.</div>
          ) : (
            <>
              <div className="mt-2 text-2xl font-semibold">{item.title}</div>
              <div className="mt-1 text-sm text-black/60">
                {itemLabel(item)} {item.subtitle ? `• ${item.subtitle}` : ""} {item.number ? `• ${item.number}` : ""}
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-black/10 p-4">
                  <div className="text-xs uppercase tracking-wider text-black/50">Identification</div>
                  <div className="mt-2 text-sm">
                    <div><span className="text-black/60">Grade:</span> {item.grade ?? ""}</div>
                    <div><span className="text-black/60">Certificate #:</span> {item.certNumber ?? ""}</div>
                    <div><span className="text-black/60">Serial #:</span> {item.serialNumber ?? ""}</div>
                  </div>
                </div>

                <div className="rounded-xl border border-black/10 p-4">
                  <div className="text-xs uppercase tracking-wider text-black/50">Storage</div>
                  <div className="mt-2 text-sm">
                    <div><span className="text-black/60">Location:</span> {item.storageLocation ?? ""}</div>
                  </div>
                </div>

                <div className="rounded-xl border border-black/10 p-4">
                  <div className="text-xs uppercase tracking-wider text-black/50">Financial</div>
                  <div className="mt-2 text-sm">
                    <div><span className="text-black/60">Purchase Cost:</span> {fmtMoney(Number(item.purchasePrice ?? 0))}</div>
                    <div><span className="text-black/60">Current Value:</span> {fmtMoney(Number(item.currentValue ?? 0))}</div>
                  </div>
                </div>

                <div className="rounded-xl border border-black/10 p-4">
                  <div className="text-xs uppercase tracking-wider text-black/50">Appraisal</div>
                  <div className="mt-2 text-sm">
                    <div><span className="text-black/60">Source:</span> {item.valueSource ?? ""}</div>
                    <div><span className="text-black/60">Updated:</span> {item.valueUpdatedAt ? fmtDate(item.valueUpdatedAt) : ""}</div>
                    <div><span className="text-black/60">Confidence:</span> {typeof item.valueConfidence === "number" ? `${item.valueConfidence}%` : ""}</div>
                  </div>
                </div>
              </div>

              {item.notes ? (
                <div className="mt-6 rounded-xl border border-black/10 p-4">
                  <div className="text-xs uppercase tracking-wider text-black/50">Notes</div>
                  <div className="mt-2 whitespace-pre-wrap text-sm">{item.notes}</div>
                </div>
              ) : null}

              <div className="mt-6 text-xs text-black/50">
                Generated {new Date().toLocaleString()} • Item ID {String(item.id)}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}