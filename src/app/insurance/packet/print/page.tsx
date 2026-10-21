// src/app/insurance/packet/print/page.tsx
"use client";

import Link from "next/link";
import { COST_LABEL, COST_NOTE, ESTIMATE_LABEL, fmtCost, fmtEstimate, insuranceCost, insuranceEstimate, insuranceScope, insuranceTotals, noEstimateNote, notCountedLine, totalsSentence } from "@/lib/insuranceDocs";
import { useInsuranceExclusions } from "@/lib/useInsuranceExclusions";
import { useEffect, useMemo, useRef, useState } from "react";
import { CloudWait, useCloudRefresh } from "@/components/vault/CloudStatus";
import { useSearchParams } from "next/navigation";

import { DEMO_ITEMS } from "@/lib/demoVault";
import { loadItemsOrSeed, loadItems, type VaultItem as ModelItem } from "@/lib/vaultModel";
import { UNIVERSE_LABEL, type UniverseKey } from "@/lib/taxonomy";

type Item = ModelItem & {
  storageLocation?: string;
  certNumber?: string;
  serialNumber?: string;
  valueSource?: string;
  valueUpdatedAt?: number;
  valueConfidence?: number;
};

const ITEMS_PER_PAGE_NO_IMAGES = 25;
const ITEMS_PER_PAGE_WITH_IMAGES = 5;

function clamp(n: number) {
  return Number.isFinite(n) ? n : 0;
}

function fmtMoney(n?: number | null) {
  const v = clamp(typeof n === "number" ? n : 0);
  const sign = v < 0 ? "-" : "";
  return `${sign}$${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
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

export default function InsurancePacketPrintPage() {
  const params = useSearchParams();
  const includeImages = params.get("images") === "1";
  const requestedPage = Math.max(0, Number(params.get("page") ?? 0) || 0);
  const [items, setItems] = useState<Item[]>([]);
  const { excluded: excludedIds, note: exclusionsNote, where: exclusionsWhere } = useInsuranceExclusions();
  const reloadRef = useRef<() => void>(() => undefined);
  const cloud = useCloudRefresh(() => reloadRef.current());

  useEffect(() => {
    const seed = toSeedItemsFromDemo();
    const loaded = loadItemsOrSeed(seed as any) as any as Item[];
    setItems(loaded);
    reloadRef.current = () => setItems(loadItems() as any as Item[]);
  }, []);

  // ONE rule set (src/lib/insuranceDocs.ts), the same as the packet screen, the inventory and the reports.
  const scope = useMemo(() => insuranceScope(items, excludedIds), [items, excludedIds]);
  const selectedItems = scope.included;
  const notCounted = notCountedLine(scope, exclusionsWhere);
  const itemsPerPage = includeImages ? ITEMS_PER_PAGE_WITH_IMAGES : ITEMS_PER_PAGE_NO_IMAGES;
  const totalPages = Math.max(1, Math.ceil(selectedItems.length / itemsPerPage));
  const pageIndex = Math.min(requestedPage, totalPages - 1);
  const visibleItems = selectedItems.slice(pageIndex * itemsPerPage, pageIndex * itemsPerPage + itemsPerPage);

  const totals = useMemo(() => insuranceTotals(selectedItems), [selectedItems]);
  const noEstimate = noEstimateNote(totals);

  // An empty list is only believed once the cloud has answered; before that, or after a failed answer, it is a wait or a load error.
  if (items.length === 0 && cloud.state !== "ok") return <CloudWait what="insurance packet" cloud={cloud} />;

  return (
    <main className="vltd-ins-light vltd-print-document vltd-paper bg-white px-5 py-5 text-black">
      <style>{`
        :root { color-scheme: light; }
        body { background: white !important; color: black !important; }
        [data-site-chrome] { display: none !important; }
        @page { size: landscape; margin: 0.25in; }
        @media print {
          .no-print { display: none !important; }
          body, main, section, div, table, thead, tbody, tr, th, td { background: white !important; color: black !important; box-shadow: none !important; }
          main { padding: 0 !important; }
          table { width: 100% !important; table-layout: fixed !important; border-collapse: collapse !important; font-size: 7.5px !important; line-height: 1.12 !important; }
          thead { display: table-header-group; }
          tr { break-inside: avoid; page-break-inside: avoid; }
          th, td { border: 1px solid #d8d8d8 !important; padding: 2px 3px !important; vertical-align: top !important; color: black !important; }
          th { background: #f1f1f1 !important; font-size: 7px !important; font-weight: 700 !important; text-transform: uppercase !important; }
          img { max-height: 70px !important; max-width: 70px !important; object-fit: contain !important; }
        }
      `}</style>

      <div className="no-print mb-4 flex items-center justify-between gap-3 rounded-xl border border-slate-300 bg-slate-50 p-3">
        <Link href="/insurance/packet" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900">
          ← Back to Packet
        </Link>
        <button onClick={() => window.print()} className="vltd-paper-btn rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-text-primary">
          Print This Page
        </button>
      </div>

      <section className="mb-3">
        <div className="text-[8px] font-bold uppercase tracking-[0.14em]">VLTD Insurance Packet</div>
        <h1 className="mt-1 text-base font-black leading-none">Insurance Policy Packet</h1>
        <div className="mt-1 text-[8px] text-slate-700">
          Generated {new Date().toLocaleString()} • Page {pageIndex + 1} of {totalPages} • Showing {visibleItems.length} of {selectedItems.length} counted items • {totalsSentence(totals)} • Images {includeImages ? "included" : "excluded"}
        </div>
        {notCounted ? <div className="mt-1 text-[8px] text-slate-700" data-testid="not-counted">{notCounted} {exclusionsNote}</div> : null}
        {noEstimate ? <div className="mt-1 text-[8px] text-slate-700" data-testid="no-estimate-note">{noEstimate}</div> : null}
        <div className="mt-1 text-[8px] text-slate-700">{COST_NOTE}</div>
      </section>

      <table className="w-full table-fixed border-collapse text-[7.5px] leading-tight">
        <thead>
          <tr>
            {includeImages ? <th className="w-[10%] border border-slate-300 bg-slate-100 p-1 text-left">Image</th> : null}
            <th className="w-[20%] border border-slate-300 bg-slate-100 p-1 text-left">Item</th>
            <th className="w-[22%] border border-slate-300 bg-slate-100 p-1 text-left">Category</th>
            <th className="w-[10%] border border-slate-300 bg-slate-100 p-1 text-left">ID</th>
            <th className="w-[12%] border border-slate-300 bg-slate-100 p-1 text-left">Storage</th>
            <th className="w-[8%] border border-slate-300 bg-slate-100 p-1 text-left">{COST_LABEL}</th>
            <th className="w-[8%] border border-slate-300 bg-slate-100 p-1 text-left">{ESTIMATE_LABEL}</th>
            <th className="w-[12%] border border-slate-300 bg-slate-100 p-1 text-left">Appraisal</th>
          </tr>
        </thead>
        <tbody>
          {visibleItems.map((item) => (
            <tr key={item.id}>
              {includeImages ? (
                <td className="border border-slate-300 p-1 align-top">
                  {item.imageFrontUrl ? <img src={item.imageFrontUrl} alt={item.title} className="max-h-[70px] max-w-[70px] object-contain" /> : "No image"}
                </td>
              ) : null}
              <td className="border border-slate-300 p-1 align-top">
                <div className="font-bold">{item.title}</div>
                <div className="text-slate-700">{item.subtitle ? `${item.subtitle} • ` : ""}{item.number ?? ""}</div>
              </td>
              <td className="border border-slate-300 p-1 align-top">{itemLabel(item)}</td>
              <td className="border border-slate-300 p-1 align-top">
                <div>Grade: {item.grade ?? "-"}</div>
                <div>Cert: {item.certNumber ?? "-"}</div>
                <div>Serial: {item.serialNumber ?? "-"}</div>
              </td>
              <td className="border border-slate-300 p-1 align-top">{item.storageLocation ?? "-"}</td>
              <td className="border border-slate-300 p-1 align-top font-bold">{fmtCost(insuranceCost(item))}</td>
              <td className="border border-slate-300 p-1 align-top font-bold">{fmtEstimate(insuranceEstimate(item))}</td>
              <td className="border border-slate-300 p-1 align-top">
                <div>{item.valueSource ?? ""}</div>
                <div>{item.valueUpdatedAt ? fmtDate(item.valueUpdatedAt) : ""}{typeof item.valueConfidence === "number" ? ` • ${item.valueConfidence}%` : ""}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
