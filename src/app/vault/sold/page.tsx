"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const SALES_KEY = "vltd_sales_history";

function money(n) {
  return $;
}

function cost(item) {
  return (
    Number(item.purchasePrice ?? 0) +
    Number(item.purchaseTax ?? 0) +
    Number(item.purchaseShipping ?? 0) +
    Number(item.purchaseFees ?? 0)
  );
}

export default function SoldPage() {
  const [items, setItems] = useState([]);

  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(SALES_KEY) || "[]");
      setItems(data);
    } catch {
      setItems([]);
    }
  }

  useEffect(() => {
    load();
    window.addEventListener("vltd:vault-updated", load);
    return () => window.removeEventListener("vltd:vault-updated", load);
  }, []);

  const totalProfit = useMemo(() => {
    return items.reduce((sum, i) => {
      return sum + (Number(i.soldPrice ?? 0) - cost(i));
    }, 0);
  }, [items]);

  return (
    <main>
      <h1>Sold Items</h1>
      <div>Total Profit: {money(totalProfit)}</div>

      {items.map((item) => {
        const profit = Number(item.soldPrice ?? 0) - cost(item);

        return (
          <Link key={item.id} href={/vault/item/?sold=1}>
            <div>
              <div>{item.title}</div>
              <div>Sold: {money(item.soldPrice)}</div>
              <div>{profit >= 0 ? "+" : ""}{money(profit)}</div>
            </div>
          </Link>
        );
      })}
    </main>
  );
}
