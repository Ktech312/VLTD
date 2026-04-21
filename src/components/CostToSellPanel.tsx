"use client";

import { useMemo, useState } from "react";

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

export default function CostToSellPanel({
  price = 0,
  shipping = 0,
}: {
  price?: number;
  shipping?: number;
}) {
  const [channel, setChannel] = useState<"ebay" | "whatnot" | "custom">("ebay");
  const [customRate, setCustomRate] = useState("12.9");

  const feeRate = useMemo(() => {
    if (channel === "ebay") return 0.129;
    if (channel === "whatnot") return 0.088;
    const parsed = Number(customRate);
    return Number.isFinite(parsed) ? parsed / 100 : 0;
  }, [channel, customRate]);

  const payout = useMemo(() => {
    const gross = Number(price ?? 0) + Number(shipping ?? 0);
    const fees = gross * feeRate;
    return {
      gross,
      fees,
      net: gross - fees,
    };
  }, [price, shipping, feeRate]);

  return (
    <div className="rounded-[24px] bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)]">
      <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted2)]">
        Cost to Sell
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(["ebay", "whatnot", "custom"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setChannel(option)}
            className={[
              "rounded-full px-4 py-2 text-sm ring-1 transition",
              channel === option
                ? "bg-[color:var(--pill-active-bg)] text-[color:var(--fg)] ring-[color:var(--pill-active-bg)]"
                : "bg-[color:var(--pill)] text-[color:var(--pill-fg)] ring-[color:var(--border)]",
            ].join(" ")}
          >
            {option === "ebay" ? "eBay" : option === "whatnot" ? "Whatnot" : "Custom"}
          </button>
        ))}
      </div>

      {channel === "custom" ? (
        <input
          value={customRate}
          onChange={(e) => setCustomRate(e.target.value)}
          className="mt-4 h-10 rounded-xl bg-[color:var(--pill)] px-3 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
          placeholder="Custom fee %"
        />
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-[color:var(--pill)] p-4 ring-1 ring-[color:var(--border)]">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">Gross</div>
          <div className="mt-2 text-lg font-semibold">{money(payout.gross)}</div>
        </div>
        <div className="rounded-2xl bg-[color:var(--pill)] p-4 ring-1 ring-[color:var(--border)]">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">Fees</div>
          <div className="mt-2 text-lg font-semibold">{money(payout.fees)}</div>
        </div>
        <div className="rounded-2xl bg-[color:var(--pill)] p-4 ring-1 ring-[color:var(--border)]">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">Net</div>
          <div className="mt-2 text-lg font-semibold">{money(payout.net)}</div>
        </div>
      </div>
    </div>
  );
}
