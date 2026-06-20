
"use client";

export default function PortfolioInsightsPanel({ stats }: { stats:any }){

  return (
    <div className="rounded-xl p-4 bg-[color:var(--theme-elevated)] ring-1 ring-[color:var(--theme-border)]">
      <div className="font-semibold mb-3">Portfolio Insights</div>

      <div>Most Valuable Category: {stats.topCategory}</div>
      <div>Best Universe: {stats.topUniverse}</div>
      <div>Total ROI: {stats.roi}%</div>
    </div>
  )
}
