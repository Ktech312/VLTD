// src/app/insurance/item/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { DEMO_ITEMS } from "@/lib/demoVault";
import { loadItems, type VaultItem as ModelItem } from "@/lib/vaultModel";
import { LoadErrorCard, StaleDataNotice, useCloudRefresh } from "@/components/vault/CloudStatus";
import { UNIVERSE_LABEL, type UniverseKey } from "@/lib/taxonomy";
import { COST_LABEL, COST_NOTE, ESTIMATE_LABEL, EXCLUSIONS_ARE_DEVICE_ONLY, fmtCost, fmtEstimate, insuranceCost, insuranceEstimate, insuranceScope, notCountedLine, readInsuranceExcludedIds } from "@/lib/insuranceDocs";
import { isSoldItem } from "@/lib/vaultStats";
import { EmptyVault } from "@/components/ui/EmptyVault";
import { PillButton } from "@/components/ui/PillButton";

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
  const [hydrated, setHydrated] = useState(false);
  const reloadRef = useRef<() => void>(() => undefined);
  const retryRef = useRef<() => void>(() => undefined);
  const cloud = useCloudRefresh(() => reloadRef.current());
  retryRef.current = cloud.retry;

  useEffect(() => {
    const reload = () => setItems(loadItems() as any as Item[]);
    reloadRef.current = reload;
    reload();
    setHydrated(true);
    // A switch of profile (or a change made elsewhere) re-reads the saved copy and asks the cloud again; the page never keeps the previous profile's items.
    const onProfile = () => { reload(); retryRef.current(); };
    window.addEventListener("vltd:active-profile", onProfile);
    window.addEventListener("vltd:vault-updated", reload);
    return () => {
      window.removeEventListener("vltd:active-profile", onProfile);
      window.removeEventListener("vltd:vault-updated", reload);
    };
  }, []);

  const id = sp.get("id") ?? "";
  const item = useMemo(() => items.find((x) => String(x.id) === String(id)), [items, id]);
  // An owner's historical sheet stays reachable for a sold item (marked Sold); the sheet also says whether the item is counted in the current totals.
  const sold = item ? isSoldItem(item) : false;
  const countedLine = useMemo(() => (item ? notCountedLine(insuranceScope([item], readInsuranceExcludedIds())) : null), [item]);

  if (hydrated && items.length === 0 && cloud.state !== "ok") {
    return (
      <main className="px-4 py-6 text-[color:var(--fg)] sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1480px]">
          {cloud.state === "failed" ? <LoadErrorCard what="item sheet" onRetry={cloud.retry} busy={cloud.busy} /> : <div role="status" className="rounded-[8px] px-6 py-8 text-center text-sm ring-1 ring-[color:var(--border)]" style={{ background: "var(--surface)", color: "var(--muted)" }}>Loading your items…</div>}
        </div>
      </main>
    );
  }
  if (hydrated && items.length === 0) {
    return (
      <EmptyVault
        eyebrow="INSURANCE"
        glyph="shield"
        title="No items to insure yet"
        message="Add collectibles to your vault and they show up here, ready for your insurance packet."
      />
    );
  }

  return (
    <main className="vltd-print-document px-4 py-6 text-[color:var(--fg)] sm:px-6 lg:px-8">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body, main, section, div { background: white !important; color: black !important; box-shadow: none !important; }
          .card { box-shadow: none !important; border: 1px solid #ddd !important; }
        }
      `}</style>

      <div className="mx-auto max-w-4xl">
        {cloud.state === "failed" && items.length > 0 ? <StaleDataNotice onRetry={cloud.retry} busy={cloud.busy} /> : null}
        <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-[color:var(--border)] bg-vault-card p-3 shadow-[0_18px_56px_rgba(0,0,0,0.22)]">
          <div className="flex flex-wrap items-center gap-2">
            <PillButton href="/insurance">
              ← Back to Insurance
            </PillButton>
            <PillButton href="/vault">
              Vault
            </PillButton>
          </div>
          <button onClick={() => window.print()} className="vltd-ins-primary rounded-[8px] px-4 py-2 text-sm font-black text-[#0B0B0B]" style={{ background: 'var(--theme-gold-gradient)', boxShadow: 'var(--theme-gold-glow)' }}>
            Print / Save as PDF
          </button>
        </div>

        <section
          className="card rounded-[12px] p-4"
          style={{
            background: 'var(--theme-elevated, rgba(20,32,55,0.9))',
            border: '1px solid var(--theme-gold-border, rgba(203,208,213,0.25))',
            boxShadow: '0 26px 86px rgba(0,0,0,0.32)',
          }}
        >
          <div className="text-[11px] font-semibold uppercase tracking-[0.30em] text-[color:var(--muted2)]">Insurance Item Sheet</div>

          {!item ? (
            <div className="mt-4 rounded-2xl border border-[color:var(--border)] bg-vault-card p-4 text-[color:var(--muted)]">
              Item not found. Go back and open a per-item sheet from the report.
            </div>
          ) : (
            <>
              {sold ? (
                <div className="mt-2 inline-block rounded-[6px] border border-[color:var(--border)] px-2 py-0.5 text-[11px] font-black uppercase tracking-[0.14em]" data-testid="sold-marker">
                  Sold{item.soldAt ? ` ${fmtDate(item.soldAt)}` : ""}{typeof item.soldPrice === "number" ? ` for ${fmtCost(item.soldPrice)}` : ""}: historical record, not part of the current inventory or its totals
                </div>
              ) : null}
              <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] text-text-primary">{item.title}</h1>
              <div className="mt-2 text-sm text-[color:var(--muted)]">
                {itemLabel(item)} {item.subtitle ? `• ${item.subtitle}` : ""} {item.number ? `• ${item.number}` : ""}
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
                <div>
                  {item.imageFrontUrl ? (
                    <img
                      src={item.imageFrontUrl}
                      alt={item.title}
                      className="max-h-[320px] w-full rounded-2xl border border-[rgba(104,146,196,0.24)] object-contain shadow-[0_18px_42px_rgba(0,0,0,0.24)]"
                    />
                  ) : (
                    <div className="grid h-72 w-full place-items-center rounded-2xl border border-[rgba(104,146,196,0.24)] bg-[linear-gradient(135deg,#141414,#141414)] text-xs font-black tracking-[0.16em] text-[color:var(--muted2)]">
                      NO IMG
                    </div>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[rgba(104,146,196,0.20)] bg-vault-card p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted2)]">Identification</div>
                    <div className="mt-3 space-y-1 text-sm text-[color:var(--fg)]">
                      <div><span className="text-[color:var(--muted)]">Grade:</span> {item.grade ?? ""}</div>
                      <div><span className="text-[color:var(--muted)]">Certificate #:</span> {item.certNumber ?? ""}</div>
                      <div><span className="text-[color:var(--muted)]">Serial #:</span> {item.serialNumber ?? ""}</div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[rgba(104,146,196,0.20)] bg-vault-card p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted2)]">Storage</div>
                    <div className="mt-3 space-y-1 text-sm text-[color:var(--fg)]">
                      <div><span className="text-[color:var(--muted)]">Location:</span> {item.storageLocation ?? ""}</div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[rgba(104,146,196,0.20)] bg-vault-card p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted2)]">Financial</div>
                    <div className="mt-3 space-y-1 text-sm text-[color:var(--fg)]">
                      <div><span className="text-[color:var(--muted)]">{COST_LABEL}:</span> <span className="font-semibold text-text-primary" data-testid="item-cost">{fmtCost(insuranceCost(item))}</span></div>
                      <div className="text-xs vltd-print-muted text-[color:var(--muted)]">{COST_NOTE}</div>
                      <div><span className="text-[color:var(--muted)]">{ESTIMATE_LABEL}:</span> <span className="font-semibold text-text-primary" data-testid="item-estimate">{fmtEstimate(insuranceEstimate(item))}</span>{insuranceEstimate(item) === null ? <span className="text-[color:var(--muted)]"> (no value entered; the cost above is not an estimate of value)</span> : null}</div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[rgba(104,146,196,0.20)] bg-vault-card p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted2)]">Appraisal</div>
                    <div className="mt-3 space-y-1 text-sm text-[color:var(--fg)]">
                      <div><span className="text-[color:var(--muted)]">Source:</span> {item.valueSource ?? ""}</div>
                      <div><span className="text-[color:var(--muted)]">Updated:</span> {item.valueUpdatedAt ? fmtDate(item.valueUpdatedAt) : ""}</div>
                      <div><span className="text-[color:var(--muted)]">Confidence:</span> {typeof item.valueConfidence === "number" ? `${item.valueConfidence}%` : ""}</div>
                    </div>
                  </div>
                </div>
              </div>

              {item.notes ? (
                <div className="mt-6 rounded-2xl border border-[rgba(104,146,196,0.20)] bg-vault-card p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted2)]">Notes</div>
                  <div className="mt-3 whitespace-pre-wrap text-sm text-[color:var(--fg)]">{item.notes}</div>
                </div>
              ) : null}

              {countedLine ? <div className="mt-4 text-xs text-[color:var(--muted)]" data-testid="not-counted">{countedLine} {EXCLUSIONS_ARE_DEVICE_ONLY}</div> : null}
              <div className="mt-6 text-xs text-[color:var(--muted2)]">
                Generated {new Date().toLocaleString()} • Item ID {String(item.id)}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}