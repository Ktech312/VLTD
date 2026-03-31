"use client";

import type { CollectionMetrics } from "@/lib/portfolioMetrics";
import { formatMoney } from "@/lib/portfolioMetrics";

type Props = {
  metrics: CollectionMetrics;
};

function Badge({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: string;
  sublabel?: string;
}) {
  return (
    <div className="vltd-panel-soft rounded-[20px] bg-[color:var(--input)] p-4 ring-1 ring-[color:var(--border)]">
      <div className="text-[11px] tracking-[0.16em] text-[color:var(--muted2)]">
        {label}
      </div>
      <div className="mt-2 text-xl font-semibold">{value}</div>
      {sublabel ? (
        <div className="mt-1 text-sm text-[color:var(--muted)]">{sublabel}</div>
      ) : null}
    </div>
  );
}

function ItemCard({
  eyebrow,
  title,
  subtitle,
  value,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  value?: string;
}) {
  return (
    <div className="vltd-panel-soft rounded-[20px] bg-[color:var(--input)] p-4 ring-1 ring-[color:var(--border)]">
      <div className="text-[11px] tracking-[0.16em] text-[color:var(--muted2)]">
        {eyebrow}
      </div>
      <div className="mt-2 text-lg font-semibold leading-tight">{title}</div>
      {subtitle ? (
        <div className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
          {subtitle}
        </div>
      ) : null}
      {value ? <div className="mt-3 text-sm font-semibold">{value}</div> : null}
    </div>
  );
}

export default function PortfolioIntelligencePanel({ metrics }: Props) {
  const topCategory = metrics.topValueSegments[0];
  const topSource = metrics.topSourceSegments[0];

  const concentration =
    metrics.totalValue > 0 && topCategory
      ? (topCategory.value / metrics.totalValue) * 100
      : 0;

  const sourceConcentration =
    metrics.totalValue > 0 && topSource
      ? (topSource.value / metrics.totalValue) * 100
      : 0;

  const healthLabel =
    metrics.roi >= 25
      ? "Strong"
      : metrics.roi >= 10
        ? "Healthy"
        : metrics.roi >= 0
          ? "Stable"
          : "Under Pressure";

  return (
    <section className="vltd-panel-main rounded-[24px] bg-[color:var(--surface)] p-5 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
      <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">
        PORTFOLIO INTELLIGENCE
      </div>

      <h2 className="mt-2 text-2xl font-semibold">Collection Valuation Signals</h2>

      <p className="mt-3 max-w-3xl text-sm leading-6 text-[color:var(--muted)]">
        A fast read on performance, concentration, and collection health for the active profile.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Badge
          label="COLLECTION HEALTH"
          value={healthLabel}
          sublabel={`${metrics.roi >= 0 ? "+" : ""}${metrics.roi.toFixed(1)}% ROI`}
        />
        <Badge
          label="VALUE CONCENTRATION"
          value={`${concentration.toFixed(0)}%`}
          sublabel={topCategory ? topCategory.label : "No dominant segment"}
        />
        <Badge
          label="SOURCE CONCENTRATION"
          value={`${sourceConcentration.toFixed(0)}%`}
          sublabel={topSource ? topSource.label : "No dominant source"}
        />
        <Badge
          label="COLLECTION BREADTH"
          value={`${metrics.universes} / ${metrics.categories}`}
          sublabel="Universes / categories"
        />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <ItemCard
          eyebrow="TOP PERFORMER"
          title={metrics.intelligence.topPerformer?.title || "No data yet"}
          subtitle={
            metrics.intelligence.topPerformer
              ? "Best profit contribution in the active collection."
              : "Add more items to surface performance leaders."
          }
          value={
            metrics.intelligence.topPerformer
              ? `${formatMoney(
                  (metrics.intelligence.topPerformer.currentValue ?? 0) as number
                )} current value`
              : undefined
          }
        />

        <ItemCard
          eyebrow="BIGGEST UNDERWATER"
          title={metrics.intelligence.biggestUnderwater?.title || "No data yet"}
          subtitle={
            metrics.intelligence.biggestUnderwater
              ? "Largest current drag on portfolio performance."
              : "Loss visibility appears once cost and value are both present."
          }
          value={
            metrics.intelligence.biggestUnderwater
              ? `${formatMoney(
                  (metrics.intelligence.biggestUnderwater.currentValue ?? 0) as number
                )} current value`
              : undefined
          }
        />

        <ItemCard
          eyebrow="HIGHEST VALUE"
          title={metrics.intelligence.highestValue?.title || "No data yet"}
          subtitle={
            metrics.intelligence.highestValue
              ? "Largest value anchor in the active profile."
              : "Highest-value item appears once values are tracked."
          }
          value={
            metrics.intelligence.highestValue
              ? `${formatMoney(
                  (metrics.intelligence.highestValue.currentValue ?? 0) as number
                )} current value`
              : undefined
          }
        />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <div className="vltd-panel-soft rounded-[20px] bg-[color:var(--input)] p-4 ring-1 ring-[color:var(--border)]">
          <div className="text-sm font-semibold">Top Value Segments</div>

          {metrics.topValueSegments.length === 0 ? (
            <div className="mt-3 text-sm text-[color:var(--muted)]">
              No category concentration data yet.
            </div>
          ) : (
            <div className="mt-4 grid gap-3">
              {metrics.topValueSegments.slice(0, 4).map((segment) => {
                const width =
                  metrics.maxSegmentValue > 0
                    ? Math.max(8, (segment.value / metrics.maxSegmentValue) * 100)
                    : 0;

                return (
                  <div key={segment.label}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{segment.label}</div>
                        <div className="text-xs text-[color:var(--muted)]">
                          {segment.count} items
                        </div>
                      </div>
                      <div className="shrink-0 text-sm font-semibold">
                        {formatMoney(segment.value)}
                      </div>
                    </div>

                    <div className="h-3 overflow-hidden rounded-full bg-black/15 ring-1 ring-[color:var(--border)]">
                      <div
                        className="h-full rounded-full bg-[color:var(--pill-active-bg)]"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="vltd-panel-soft rounded-[20px] bg-[color:var(--input)] p-4 ring-1 ring-[color:var(--border)]">
          <div className="text-sm font-semibold">Top Acquisition Sources</div>

          {metrics.topSourceSegments.length === 0 ? (
            <div className="mt-3 text-sm text-[color:var(--muted)]">
              No source concentration data yet.
            </div>
          ) : (
            <div className="mt-4 grid gap-3">
              {metrics.topSourceSegments.slice(0, 4).map((segment) => {
                const width =
                  metrics.totalValue > 0
                    ? Math.max(8, (segment.value / metrics.totalValue) * 100)
                    : 0;

                return (
                  <div key={segment.label}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{segment.label}</div>
                        <div className="text-xs text-[color:var(--muted)]">
                          {segment.count} items
                        </div>
                      </div>
                      <div className="shrink-0 text-sm font-semibold">
                        {formatMoney(segment.value)}
                      </div>
                    </div>

                    <div className="h-3 overflow-hidden rounded-full bg-black/15 ring-1 ring-[color:var(--border)]">
                      <div
                        className="h-full rounded-full bg-[color:var(--pill-active-bg)]"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}