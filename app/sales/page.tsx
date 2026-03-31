"use client";

import { useEffect, useState } from "react";
import { loadSales, type SaleRecord } from "@/lib/salesHistory";

function fmtMoney(n: number | undefined) {
  const v = Number(n ?? 0);
  const sign = v < 0 ? "-" : "";
  return `${sign}$${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function fmtDate(ms: number) {
  return new Date(ms).toLocaleString();
}

export default function SalesHistoryPage() {
  const [sales, setSales] = useState<SaleRecord[]>([]);

  useEffect(() => {
    setSales(loadSales());
  }, []);

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Sales History</h1>

      <div className="grid gap-4">
        {sales.length === 0 && (
          <div className="text-sm text-gray-400">
            No sales recorded yet.
          </div>
        )}

        {sales.map((s) => {
          const profit =
            Number(s.salePrice ?? 0) - Number(s.purchasePrice ?? 0);

          return (
            <div key={s.id} className="p-4 rounded-xl bg-black/20 ring-1 ring-white/10">
              <div className="font-medium">{s.title ?? "Untitled"}</div>

              <div className="text-sm opacity-70 mt-1">
                {fmtDate(s.soldAt)}
              </div>

              <div className="mt-2 text-sm">
                Purchase: {fmtMoney(s.purchasePrice)} • Sale: {fmtMoney(s.salePrice)}
              </div>

              <div
                className={
                  "mt-1 font-semibold " +
                  (profit >= 0 ? "text-emerald-400" : "text-red-400")
                }
              >
                {profit >= 0 ? "+" : ""}
                {fmtMoney(profit)}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}