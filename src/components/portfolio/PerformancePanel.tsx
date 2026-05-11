
"use client";

export default function PerformancePanel({ metrics }: { metrics: any }) {

  return (
    <div className="rounded-xl p-4 bg-[color:var(--theme-elevated)] ring-1 ring-[color:var(--theme-border)]">
      <div className="font-semibold mb-3">Portfolio Performance</div>

      <div>Total Value: ${metrics.totalValue}</div>
      <div>Total Cost: ${metrics.totalCost}</div>
      <div>Profit: ${metrics.totalProfit}</div>
    </div>
  );
}
