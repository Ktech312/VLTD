
"use client";

export default function SaleHistoryCard({ sale }: { sale: any }) {
  return (
    <div className="rounded-xl p-4 bg-black/20 ring-1 ring-white/10">
      <div className="font-semibold">Item {sale.itemId}</div>
      <div>Sale Price: ${sale.salePrice}</div>
      <div>Profit: ${sale.profit}</div>
    </div>
  );
}
