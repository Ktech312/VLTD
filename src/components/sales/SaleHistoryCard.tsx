
"use client";

export default function SaleHistoryCard({ sale }: { sale: any }) {
  return (
    <div className="rounded-xl p-4 bg-[color:var(--surface)] ring-1 ring-[color:var(--border)]">
      <div className="font-semibold">Item {sale.itemId}</div>
      <div>Sale Price: ${sale.salePrice}</div>
      <div>Profit: ${sale.profit}</div>
    </div>
  );
}
