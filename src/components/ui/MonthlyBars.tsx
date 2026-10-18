"use client";

import { INSIGHTS_GREEN, INSIGHTS_RED, INSIGHTS_REVENUE } from "@/lib/insightsPalette";

export type MonthlyBar = {
  /** "YYYY-MM" */
  key: string;
  /** null = nothing to plot for this month (for example profit when no sale in it has a recorded cost). */
  value: number | null;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const PLOT_H = 84; // px for the bars themselves
const LABEL_H = 14; // px reserved above the tallest bar (and below the deepest loss, when there is one) for value labels
const MONTH_H = 14; // px for the month names along the bottom

function monthLabel(key: string, withYear: boolean) {
  const [y, m] = key.split("-");
  const name = MONTHS[Number(m) - 1] ?? key;
  return withYear ? `${name} ’${String(y).slice(2)}` : name;
}

function compact(n: number) {
  const a = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (a >= 10_000) return `${sign}$${Math.round(a / 1000)}k`;
  if (a >= 1_000) return `${sign}$${(a / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return `${sign}$${Math.round(a).toLocaleString()}`;
}

function full(n: number) {
  return `${n < 0 ? "-" : ""}$${Math.abs(Math.round(n)).toLocaleString()}`;
}

/**
 * Small column chart for monthly money: a real baseline, one column per month (capped width, so one or two months never
 * become huge blocks), a value above each column, a month name below. `signed` charts draw gains upward in green and
 * losses downward in red from the baseline; otherwise every column is the single series colour.
 */
export function MonthlyBars({
  months,
  signed = false,
  color = INSIGHTS_REVENUE,
  ariaLabel,
}: {
  months: MonthlyBar[];
  signed?: boolean;
  color?: string;
  ariaLabel: string;
}) {
  if (months.length === 0) return <div className="text-[12px]" style={{ color: "var(--muted)" }}>No sales yet.</div>;

  const nums = months.map((m) => m.value).filter((v): v is number => v !== null);
  const maxPos = Math.max(0, ...nums);
  const maxNeg = signed ? Math.max(0, ...nums.map((v) => -v)) : 0;
  const span = maxPos + maxNeg;
  const scale = span > 0 ? PLOT_H / span : 0;
  const baseline = maxNeg * scale; // px from the bottom of the plot to the zero line
  const withYear = new Set(months.map((m) => m.key.slice(0, 4))).size > 1;
  const showAllValues = months.length <= 8;
  const best = nums.length ? nums.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a), 0) : 0;
  const lastIdx = months.length - 1;
  // With many columns every other month name is shown (always the latest), so names never run into each other.
  const showMonth = (i: number) => months.length <= 8 || (lastIdx - i) % 2 === 0;
  const zeroY = MONTH_H + (maxNeg > 0 ? LABEL_H : 0) + baseline; // from the bottom of the chart
  const total = zeroY + (maxPos > 0 ? PLOT_H - baseline : 0) + LABEL_H;

  return (
    <div role="img" aria-label={ariaLabel} data-testid="monthly-bars">
      <div className="relative" style={{ height: total, display: "grid", gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))`, columnGap: 6 }}>
        <div aria-hidden="true" className="pointer-events-none absolute left-0 right-0" style={{ bottom: zeroY, height: 1, background: "var(--theme-border, rgba(203,208,213,0.3))" }} />
        {months.map((m, i) => {
          const v = m.value;
          const barH = v === null || v === 0 ? 0 : Math.max(3, Math.abs(v) * scale);
          const up = v === null || v >= 0;
          const fill = !signed ? color : up ? INSIGHTS_GREEN : INSIGHTS_RED;
          const labelled = v !== null && (showAllValues || v === best || i === lastIdx);
          return (
            <div key={m.key} className="relative" style={{ minWidth: 0 }}>
              {v !== null && v !== 0 ? (
                <div
                  aria-hidden="true"
                  className="absolute left-1/2"
                  style={{
                    width: "min(100%, 30px)",
                    transform: "translateX(-50%)",
                    height: barH,
                    bottom: up ? zeroY : zeroY - barH,
                    background: fill,
                    borderRadius: up ? "3px 3px 0 0" : "0 0 3px 3px",
                  }}
                />
              ) : null}
              {labelled ? (
                <div
                  aria-hidden="true"
                  className="absolute left-0 right-0 text-center text-[10px] font-semibold"
                  style={{
                    color: !signed || v === 0 ? "var(--muted)" : v! < 0 ? INSIGHTS_RED : INSIGHTS_GREEN,
                    fontVariantNumeric: "tabular-nums",
                    whiteSpace: "nowrap",
                    bottom: up ? zeroY + barH + 1 : zeroY - barH - 13,
                  }}
                >
                  {compact(v!)}
                </div>
              ) : null}
              {v === null ? (
                <div aria-hidden="true" className="absolute left-0 right-0 text-center text-[10px]" style={{ color: "var(--muted2)", bottom: zeroY + 1 }} title="No sale this month has a recorded cost">
                  no cost
                </div>
              ) : null}
              <div aria-hidden="true" className="absolute bottom-0 left-0 right-0 text-center text-[10px]" style={{ color: "var(--muted)", whiteSpace: "nowrap", height: MONTH_H - 2, lineHeight: `${MONTH_H - 2}px` }}>
                {showMonth(i) ? monthLabel(m.key, withYear && (months.length <= 6 || i === 0 || m.key.endsWith("-01"))) : ""}
              </div>
            </div>
          );
        })}
      </div>
      <span className="sr-only">{months.map((m) => `${monthLabel(m.key, withYear)} ${m.value === null ? "no recorded cost" : full(m.value)}`).join(", ")}</span>
    </div>
  );
}
