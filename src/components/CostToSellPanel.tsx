"use client";

import { useMemo, useState } from "react";
import { FEE_RULES, type Channel } from "@/lib/sellerFees";

const CHANNELS: Array<{ id: Channel; label: string }> = [
  { id: "ebay", label: "eBay" },
  { id: "mercari", label: "Mercari" },
  { id: "whatnot", label: "Whatnot" },
  { id: "pwcc", label: "Fanatics Collect (PWCC)" },
  { id: "discogs", label: "Discogs" },
  { id: "custom", label: "Custom" },
];

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function recommendedChannel(category?: string): Channel {
  const label = String(category ?? "").toLowerCase();
  if (label.includes("vinyl") || label.includes("record")) return "discogs";
  if (label.includes("card") || label.includes("tcg") || label.includes("sports")) return "ebay";
  if (label.includes("comic")) return "ebay";
  if (label.includes("game")) return "ebay";
  return "ebay";
}

function platformNote(category?: string) {
  const label = String(category ?? "").toLowerCase();
  if (label.includes("vinyl") || label.includes("record")) return "Discogs is often strongest for vinyl, with eBay as a broader fallback.";
  if (label.includes("card") || label.includes("tcg") || label.includes("sports")) return "Cards usually start with eBay; PWCC can make sense for higher-end graded pieces.";
  if (label.includes("comic")) return "Comics usually start with eBay; MyComicShop or Heritage can be better for stronger keys.";
  if (label.includes("game")) return "Games usually start with eBay; specialty buyers can work for graded or sealed pieces.";
  return "eBay is the broadest default until category-specific marketplace data is available.";
}

export default function CostToSellPanel({
  price = 0,
  costBasis = 0,
  shippingCost = 0,
  category,
}: {
  price?: number;
  costBasis?: number;
  shippingCost?: number;
  category?: string;
}) {
  const suggestedChannel = recommendedChannel(category);
  const [channel, setChannel] = useState<Channel>(suggestedChannel);
  const [salePrice, setSalePrice] = useState(String(price || ""));
  const [shipping, setShipping] = useState(String(shippingCost || ""));
  const [customRate, setCustomRate] = useState("12.9");

  const payout = useMemo(() => {
    const gross = Number(salePrice || 0);
    const shipCost = Number(shipping || 0);
    let fees: number;
    let feeSummary: string;
    if (channel === "custom") {
      const parsed = Number(customRate);
      const rate = Number.isFinite(parsed) ? parsed / 100 : 0;
      fees = gross * rate;
      feeSummary = `${Number.isFinite(parsed) ? parsed : 0}% (your own rate)`;
    } else {
      const result = FEE_RULES[channel](gross, category);
      fees = result.total;
      feeSummary = result.summary;
    }
    const net = gross - fees - shipCost;
    const gain = net - Number(costBasis ?? 0);
    return {
      gross,
      shipCost,
      fees,
      feeSummary,
      net,
      gain,
    };
  }, [salePrice, shipping, channel, customRate, category, costBasis]);

  const hasPrice = payout.gross > 0;

  return (
    <div className="rounded-[24px] bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted2)]">
            Cost to Sell
          </div>
          <div className="mt-2 text-sm text-[color:var(--muted)]">
            Estimate fees, shipping, and net gain before marking an item sold.
          </div>
        </div>
        <div className="rounded-full bg-[color:var(--pill)] px-3 py-1 text-[11px] font-semibold text-[color:var(--theme-gold)] ring-1 ring-[color:var(--border)]">
          Suggest: {CHANNELS.find((option) => option.id === suggestedChannel)?.label}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted2)]">Sale Price</span>
          <input
            value={salePrice}
            onChange={(e) => setSalePrice(e.target.value)}
            className="h-10 rounded-xl bg-[color:var(--pill)] px-3 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
            inputMode="decimal"
            placeholder="Estimated sale price"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted2)]">Shipping Cost</span>
          <input
            value={shipping}
            onChange={(e) => setShipping(e.target.value)}
            className="h-10 rounded-xl bg-[color:var(--pill)] px-3 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
            inputMode="decimal"
            placeholder="Packing + postage"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {CHANNELS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setChannel(option.id)}
            className={[
              "rounded-full px-4 py-2 text-sm ring-1 transition",
              channel === option.id
                ? "bg-[color:var(--pill-active-bg)] text-[color:var(--fg)] ring-[color:var(--pill-active-bg)]"
                : "bg-[color:var(--pill)] text-[color:var(--pill-fg)] ring-[color:var(--border)]",
            ].join(" ")}
          >
            {option.label}
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

      <div className="mt-2 text-[11px] leading-4 text-[color:var(--muted)]">
        {hasPrice
          ? `Fees used: ${payout.feeSummary}. Checked October 2026. Marketplaces change their fees, so confirm in your seller account.`
          : "Type the price you expect to sell it for. Fees for each marketplace are worked out from published rates."}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl bg-[color:var(--pill)] p-4 ring-1 ring-[color:var(--border)]">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">Gross</div>
          <div className="mt-2 text-lg font-semibold">{money(payout.gross)}</div>
        </div>
        <div className="rounded-2xl bg-[color:var(--pill)] p-4 ring-1 ring-[color:var(--border)]">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">Fees</div>
          <div className="mt-2 text-lg font-semibold">{hasPrice ? money(payout.fees) : "—"}</div>
        </div>
        <div className="rounded-2xl bg-[color:var(--pill)] p-4 ring-1 ring-[color:var(--border)]">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">Ship Cost</div>
          <div className="mt-2 text-lg font-semibold">{money(payout.shipCost)}</div>
        </div>
        <div className="rounded-2xl bg-[color:var(--pill)] p-4 ring-1 ring-[color:var(--border)]">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">Net</div>
          <div className="mt-2 text-lg font-semibold">{hasPrice ? money(payout.net) : "—"}</div>
        </div>
      </div>

      <div className="mt-3 rounded-2xl bg-[color:var(--theme-elevated)] p-4 ring-1 ring-[color:var(--theme-border)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">Net Gain / Loss</div>
            <div className={["mt-2 text-2xl font-semibold", !hasPrice ? "" : payout.gain >= 0 ? "text-emerald-300" : "text-red-300"].join(" ")}>
              {hasPrice ? (payout.gain >= 0 ? "+" : "") : ""}
              {hasPrice ? money(payout.gain) : "—"}
            </div>
          </div>
          <div className="text-right text-xs text-[color:var(--muted)]">
            Cost basis: {money(Number(costBasis ?? 0))}
          </div>
        </div>
        <div className="mt-3 text-xs leading-5 text-[color:var(--muted)]">
          {platformNote(category)}
        </div>
      </div>
    </div>
  );
}
