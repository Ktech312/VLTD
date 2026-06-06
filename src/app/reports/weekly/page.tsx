"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { formatPrice } from "@/lib/pricingMvp";
import { getOrderedImages, loadItems, type VaultItem } from "@/lib/vaultModel";

type GapKind = "photo" | "cost" | "value" | "condition" | "insurance";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const VALUE_STALE_MS = 30 * 24 * 60 * 60 * 1000;

function clampMoney(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function itemCost(item: VaultItem) {
  return (
    clampMoney(item.purchasePrice) +
    clampMoney(item.purchaseTax) +
    clampMoney(item.purchaseShipping) +
    clampMoney(item.purchaseFees)
  );
}

function itemValue(item: VaultItem) {
  return clampMoney(item.currentValue ?? item.valueMedian ?? item.estimatedValue ?? item.lastCompValue);
}

function itemCreatedAt(item: VaultItem) {
  const createdAt = Number(item.createdAt ?? 0);
  return Number.isFinite(createdAt) ? createdAt : 0;
}

function hasPhoto(item: VaultItem) {
  return getOrderedImages(item).length > 0 || Boolean(item.imageFrontUrl || item.imageBackUrl || item.imageFrontStoragePath);
}

function hasInsuranceBasics(item: VaultItem) {
  return hasPhoto(item) && itemValue(item) > 0 && Boolean(item.notes || item.certNumber || item.serialNumber || item.storageLocation);
}

function hasCondition(item: VaultItem) {
  return Boolean(item.grade || item.conditionReason || item.conditionSource);
}

function valueUpdatedAt(item: VaultItem) {
  const updatedAt = Number(item.valueUpdatedAt ?? item.priceUpdatedAt ?? 0);
  return Number.isFinite(updatedAt) ? updatedAt : 0;
}

function universeLabel(value?: string) {
  return String(value || "MISC").replace(/_/g, " ");
}

function getGapKinds(item: VaultItem): GapKind[] {
  const gaps: GapKind[] = [];
  if (!hasPhoto(item)) gaps.push("photo");
  if (itemCost(item) <= 0) gaps.push("cost");
  if (itemValue(item) <= 0) gaps.push("value");
  if (!hasCondition(item)) gaps.push("condition");
  if (!hasInsuranceBasics(item)) gaps.push("insurance");
  return gaps;
}

function StatCard({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="rounded-2xl bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)]">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-[color:var(--fg)]">{value}</div>
      {helper ? <div className="mt-1 text-xs text-[color:var(--muted)]">{helper}</div> : null}
    </div>
  );
}

function ItemRow({ item, detail }: { item: VaultItem; detail: string }) {
  return (
    <Link
      href={`/vault/item/${encodeURIComponent(item.id)}`}
      className="block rounded-2xl bg-[color:var(--pill)] p-3 ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill-hover)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-[color:var(--fg)]">{item.title}</div>
          <div className="mt-1 text-xs text-[color:var(--muted)]">{detail}</div>
        </div>
        <div className="shrink-0 text-right text-xs text-[color:var(--muted)]">
          <div>{formatPrice(itemValue(item))}</div>
          <div className="mt-1">{universeLabel(item.universe)}</div>
        </div>
      </div>
    </Link>
  );
}

export default function WeeklyVaultReportPage() {
  const [items] = useState<VaultItem[]>(() => loadItems());
  const [now] = useState(() => Date.now());
  const weekStart = now - WEEK_MS;

  const report = useMemo(() => {
    const collectionItems = items.filter((item) => item.status !== "WISHLIST");
    const newItems = collectionItems
      .filter((item) => itemCreatedAt(item) >= weekStart)
      .sort((a, b) => itemCreatedAt(b) - itemCreatedAt(a));
    const soldItems = collectionItems
      .filter((item) => item.status === "SOLD" || item.soldAt)
      .sort((a, b) => Number(b.soldAt ?? 0) - Number(a.soldAt ?? 0));
    const missingPhoto = collectionItems.filter((item) => !hasPhoto(item));
    const missingCost = collectionItems.filter((item) => itemCost(item) <= 0);
    const missingValue = collectionItems.filter((item) => itemValue(item) <= 0);
    const missingCondition = collectionItems.filter((item) => !hasCondition(item));
    const insuranceGaps = collectionItems.filter((item) => !hasInsuranceBasics(item));
    const forSaleItems = collectionItems.filter((item) => item.status === "FOR_SALE");
    const publicItems = collectionItems.filter((item) => item.isPublic === true);
    const staleValuations = collectionItems.filter((item) => itemValue(item) > 0 && valueUpdatedAt(item) > 0 && now - valueUpdatedAt(item) > VALUE_STALE_MS);

    const byUniverse = new Map<string, { count: number; value: number }>();
    collectionItems.forEach((item) => {
      const key = universeLabel(item.universe);
      const current = byUniverse.get(key) ?? { count: 0, value: 0 };
      byUniverse.set(key, {
        count: current.count + 1,
        value: current.value + itemValue(item),
      });
    });

    const totalValue = collectionItems.reduce((sum, item) => sum + itemValue(item), 0);
    const totalCost = collectionItems.reduce((sum, item) => sum + itemCost(item), 0);
    const valueAdded = newItems.reduce((sum, item) => sum + itemValue(item), 0);
    const costAdded = newItems.reduce((sum, item) => sum + itemCost(item), 0);
    const soldValue = soldItems.reduce((sum, item) => sum + clampMoney(item.soldPrice), 0);

    return {
      collectionItems,
      newItems,
      soldItems,
      missingPhoto,
      missingCost,
      missingValue,
      missingCondition,
      insuranceGaps,
      forSaleItems,
      publicItems,
      staleValuations,
      totalValue,
      totalCost,
      valueAdded,
      costAdded,
      soldValue,
      byUniverse: Array.from(byUniverse.entries())
        .sort((a, b) => b[1].value - a[1].value)
        .slice(0, 6),
    };
  }, [items, now, weekStart]);

  const generatedLabel = new Date(now).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--muted2)]">Weekly Vault Report</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Collector health check</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--muted)]">
              A local-first weekly report foundation for new items, sold items, value changes, and insurance gaps. Generated {generatedLabel}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/vault" className="rounded-full bg-[color:var(--pill)] px-4 py-2 text-sm ring-1 ring-[color:var(--border)]">
              Vault
            </Link>
            <Link href="/reports/insurance" className="rounded-full bg-[color:var(--pill)] px-4 py-2 text-sm ring-1 ring-[color:var(--border)]">
              Insurance Report
            </Link>
          </div>
        </div>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Vault Value" value={formatPrice(report.totalValue)} helper={`Cost basis ${formatPrice(report.totalCost)}`} />
          <StatCard label="New This Week" value={String(report.newItems.length)} helper={`${formatPrice(report.valueAdded)} value added`} />
          <StatCard label="Sold Recorded" value={String(report.soldItems.length)} helper={`${formatPrice(report.soldValue)} sold proceeds`} />
          <StatCard label="Insurance Gaps" value={String(report.insuranceGaps.length)} helper="Missing photo, value, or proof fields" />
          <StatCard label="For Sale" value={String(report.forSaleItems.length)} helper="Ready for listing review" />
          <StatCard label="Public Items" value={String(report.publicItems.length)} helper={`${report.collectionItems.length - report.publicItems.length} private`} />
          <StatCard label="Missing Condition" value={String(report.missingCondition.length)} helper="Grade or condition note needed" />
          <StatCard label="Stale Values" value={String(report.staleValuations.length)} helper="Value source older than 30 days" />
        </section>

        <div className="mt-6 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-[24px] bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">This Week</div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <div>
                <div className="mb-2 text-sm font-semibold">New items</div>
                <div className="space-y-2">
                  {report.newItems.slice(0, 8).map((item) => (
                    <ItemRow key={item.id} item={item} detail={`Added value ${formatPrice(itemValue(item))}`} />
                  ))}
                  {report.newItems.length === 0 ? (
                    <div className="rounded-2xl bg-[color:var(--pill)] p-3 text-sm text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">
                      No new vault items in the last 7 days.
                    </div>
                  ) : null}
                </div>
              </div>

              <div>
                <div className="mb-2 text-sm font-semibold">Sold items</div>
                <div className="space-y-2">
                  {report.soldItems.slice(0, 8).map((item) => (
                    <ItemRow key={item.id} item={item} detail={`Sold for ${formatPrice(clampMoney(item.soldPrice))}`} />
                  ))}
                  {report.soldItems.length === 0 ? (
                    <div className="rounded-2xl bg-[color:var(--pill)] p-3 text-sm text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">
                      No sold items recorded yet.
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[24px] bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">Top Universes</div>
            <div className="mt-4 space-y-3">
              {report.byUniverse.map(([universe, data]) => (
                <div key={universe} className="rounded-2xl bg-[color:var(--pill)] p-3 ring-1 ring-[color:var(--border)]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold">{universe}</div>
                    <div className="text-sm text-[color:var(--muted)]">{formatPrice(data.value)}</div>
                  </div>
                  <div className="mt-1 text-xs text-[color:var(--muted)]">{data.count} item{data.count === 1 ? "" : "s"}</div>
                </div>
              ))}
              {report.byUniverse.length === 0 ? (
                <div className="rounded-2xl bg-[color:var(--pill)] p-3 text-sm text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">
                  No collection items yet.
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <section className="mt-5 rounded-[24px] bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">Sale & Sharing</div>
              <div className="mt-1 text-sm text-[color:var(--muted)]">Items that are public or marked for sale this week&apos;s review.</div>
            </div>
            <Link href="/vault/for-sale" className="rounded-full bg-[color:var(--pill)] px-4 py-2 text-sm ring-1 ring-[color:var(--border)]">
              For Sale Prep
            </Link>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div>
              <div className="mb-2 text-sm font-semibold">For sale</div>
              <div className="space-y-2">
                {report.forSaleItems.slice(0, 6).map((item) => (
                  <ItemRow key={item.id} item={item} detail={`Asking ${formatPrice(Number(item.askingPrice ?? itemValue(item)))}`} />
                ))}
                {report.forSaleItems.length === 0 ? (
                  <div className="rounded-2xl bg-[color:var(--pill)] p-3 text-sm text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">
                    No items are marked for sale.
                  </div>
                ) : null}
              </div>
            </div>

            <div>
              <div className="mb-2 text-sm font-semibold">Public vault</div>
              <div className="space-y-2">
                {report.publicItems.slice(0, 6).map((item) => (
                  <ItemRow key={item.id} item={item} detail="Visible through public vault links" />
                ))}
                {report.publicItems.length === 0 ? (
                  <div className="rounded-2xl bg-[color:var(--pill)] p-3 text-sm text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">
                    No items are public. Shared vault links will be empty until you unlock items.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-[24px] bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">Action List</div>
              <div className="mt-1 text-sm text-[color:var(--muted)]">The items most likely to weaken sharing, valuation, or insurance readiness.</div>
            </div>
            <div className="text-xs text-[color:var(--muted)]">
              Photos {report.missingPhoto.length} / Cost {report.missingCost.length} / Value {report.missingValue.length} / Condition {report.missingCondition.length}
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {report.insuranceGaps.slice(0, 12).map((item) => (
              <Link
                key={item.id}
                href={`/vault/item/${encodeURIComponent(item.id)}`}
                className="rounded-2xl bg-[color:var(--pill)] p-3 ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill-hover)]"
              >
                <div className="truncate text-sm font-semibold">{item.title}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {getGapKinds(item).map((gap) => (
                    <span key={gap} className="rounded-full bg-[color:var(--surface)] px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">
                      {gap}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
            {report.insuranceGaps.length === 0 ? (
              <div className="rounded-2xl bg-[color:var(--pill)] p-3 text-sm text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">
                No insurance readiness gaps found.
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
