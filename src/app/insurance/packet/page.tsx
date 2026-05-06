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

function clamp(n: number) {
  return Number.isFinite(n) ? n : 0;
}

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
    <main className="vltd-page-depth min-h-screen px-4 py-6 text-[color:var(--fg)] sm:px-6 lg:px-8">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .page-break { break-before: page; page-break-before: always; }
          img { break-inside: avoid; }
          body, main, section, article, div { background: white !important; color: black !important; box-shadow: none !important; }
          .packet-card { border: 1px solid #ddd !important; }
        }
      `}</style>

      <div className="mx-auto max-w-6xl">
        <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-[rgba(82,214,244,0.24)] bg-[rgba(15,29,49,0.72)] p-3 shadow-[0_18px_56px_rgba(0,0,0,0.22)]">
          <Link href="/insurance" className="rounded-full border border-[color:var(--border)] bg-[rgba(7,16,31,0.48)] px-4 py-2 text-sm font-semibold text-[color:var(--accent)] transition hover:border-[rgba(82,214,244,0.42)]">
            ← Back
          </Link>
          <button
            onClick={() => window.print()}
            className="rounded-full bg-[#52d6f4] px-4 py-2 text-sm font-black text-[#06101d] shadow-[0_14px_38px_rgba(82,214,244,0.18)]"
          >
            Print / Save as PDF
          </button>
        </div>

        <section className="rounded-[30px] border border-[rgba(82,214,244,0.28)] bg-[linear-gradient(180deg,rgba(18,38,66,0.94),rgba(8,18,32,0.96))] p-5 shadow-[0_26px_86px_rgba(82,214,244,0.10),0_24px_88px_rgba(0,0,0,0.32)] sm:p-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.30em] text-[color:var(--muted2)]">Insurance Packet</div>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] text-white">Insurance Policy Packet</h1>
          <div className="mt-2 text-sm text-[color:var(--muted)]">
            Generated {new Date().toLocaleString()} • Items {items.length} • Total Value {fmtMoney(totals.value)}
          </div>
        </section>

        <div className="mt-6 space-y-5">
          {items.map((item) => (
            <article key={item.id} className="packet-card page-break rounded-[28px] border border-[rgba(104,146,196,0.24)] bg-[linear-gradient(180deg,rgba(17,35,59,0.88),rgba(9,20,36,0.94))] p-5 shadow-[0_18px_56px_rgba(0,0,0,0.24)]">
              <div className="grid gap-5 md:grid-cols-[190px_minmax(0,1fr)]">
                <div className="w-full shrink-0">
                  {item.imageFrontUrl ? (
                    <img
                      src={item.imageFrontUrl}
                      alt={item.title}
                      className="max-h-[280px] w-full rounded-2xl border border-[rgba(104,146,196,0.24)] object-contain shadow-[0_18px_42px_rgba(0,0,0,0.24)]"
                    />
                  ) : (
                    <div className="grid h-64 w-full place-items-center rounded-2xl border border-[rgba(104,146,196,0.24)] bg-[linear-gradient(135deg,#0a1424,#162038)] text-xs font-black tracking-[0.16em] text-[color:var(--muted2)]">
                      NO IMG
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <h2 className="text-2xl font-black tracking-[-0.03em] text-white">{item.title}</h2>
                  <div className="mt-1 text-sm text-[color:var(--muted)]">{itemLabel(item)}</div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-[rgba(104,146,196,0.20)] bg-[rgba(7,16,31,0.42)] p-4 text-sm text-[#dbeafe]">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted2)]">Identification</div>
                      <div className="mt-3 space-y-1">
                        <div><span className="text-[color:var(--muted)]">Grade:</span> {item.grade ?? "-"}</div>
                        <div><span className="text-[color:var(--muted)]">Cert #:</span> {item.certNumber ?? "-"}</div>
                        <div><span className="text-[color:var(--muted)]">Serial #:</span> {item.serialNumber ?? "-"}</div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-[rgba(104,146,196,0.20)] bg-[rgba(7,16,31,0.42)] p-4 text-sm text-[#dbeafe]">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted2)]">Value / Storage</div>
                      <div className="mt-3 space-y-1">
                        <div><span className="text-[color:var(--muted)]">Storage:</span> {item.storageLocation ?? "-"}</div>
                        <div><span className="text-[color:var(--muted)]">Cost:</span> <span className="font-semibold text-white">{fmtMoney(item.purchasePrice)}</span></div>
                        <div><span className="text-[color:var(--muted)]">Value:</span> <span className="font-semibold text-white">{fmtMoney(item.currentValue)}</span></div>
                      </div>
                    </div>
                  </div>

                  {item.valueSource && (
                    <div className="mt-4 rounded-2xl border border-[rgba(104,146,196,0.20)] bg-[rgba(7,16,31,0.30)] p-3 text-xs text-[color:var(--muted)]">
                      Source: {item.valueSource} • Updated {fmtDate(item.valueUpdatedAt)} • Confidence {item.valueConfidence ?? 0}%
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}