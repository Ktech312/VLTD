"use client";

import { PillButton } from "@/components/ui/PillButton";
import { useMemo, useState } from "react";
import { FEE_RULES, type Channel } from "@/lib/sellerFees";
import { marketplaceAdvice, marketplacesFor, type ItemPlace } from "@/lib/marketplaces";

const CHANNEL_LABEL: Record<Channel, string> = {
  ebay: "eBay",
  mercari: "Mercari",
  whatnot: "Whatnot",
  pwcc: "Fanatics Collect",
  discogs: "Discogs",
  custom: "Custom",
};

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

const INPUT =
  "h-9 w-full rounded-lg bg-[color:var(--pill)] px-3 text-sm ring-1 ring-[color:var(--border)] focus:outline-none max-md:h-11";
const LABEL = "text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted2)]";

/**
 * Cost to Sell: what an item would net after marketplace fees and shipping. The marketplaces offered fit the item's category
 * (see lib/marketplaces.ts); Custom (your own fee percentage) is always there.
 */
export default function CostToSellPanel({
  price = 0,
  costBasis = 0,
  category,
  universe,
  subcategory,
}: {
  price?: number;
  costBasis?: number;
  category?: string;
  universe?: string;
  subcategory?: string;
}) {
  const place: ItemPlace = useMemo(() => ({ universe, category, subcategory }), [universe, category, subcategory]);
  const allowed = useMemo<Channel[]>(() => [...marketplacesFor(place), "custom"], [place]);
  const advice = useMemo(() => marketplaceAdvice(place), [place]);

  const [picked, setPicked] = useState<Channel | null>(null);
  // If the item's category changes, a choice that no longer fits falls back to the suggestion.
  const channel: Channel = picked && allowed.includes(picked) ? picked : advice.suggested;
  const [salePrice, setSalePrice] = useState(String(price || ""));
  // Estimated OUTBOUND postage to the buyer. Left empty until the person supplies it: what was paid to receive the item (acquisition shipping)
  // is already part of the cost basis and is never copied in here, so it cannot be counted twice.
  const [shipping, setShipping] = useState("");
  const [customRate, setCustomRate] = useState("12.9");
  // Optional: your own fee percent for the chosen marketplace. When filled in it replaces the built-in table.
  const [override, setOverride] = useState("");

  const payout = useMemo(() => {
    const gross = Number(salePrice || 0);
    // Empty = not entered (net excludes postage); 0 = the person said shipping is free; both leave net unchanged, but they are reported differently.
    const shippingEntered = shipping.trim() !== "" && Number.isFinite(Number(shipping));
    const shipCost = shippingEntered ? Math.max(0, Number(shipping)) : 0;
    let fees: number;
    let feeSummary: string;
    let status: "verified" | "partly" | "yours" = "yours";
    let source = "";
    let caveat = "";
    const overrideNum = override.trim() === "" ? null : Number(override);
    if (channel !== "custom" && overrideNum !== null && Number.isFinite(overrideNum) && overrideNum >= 0) {
      fees = gross * (overrideNum / 100);
      feeSummary = `${overrideNum}% of the sale price (your own rate). It replaces the marketplace's whole fee, so any fixed per-order charge is not added on top`;
    } else if (channel === "custom") {
      const parsed = Number(customRate);
      const rate = Number.isFinite(parsed) ? parsed / 100 : 0;
      fees = gross * rate;
      feeSummary = `${Number.isFinite(parsed) ? parsed : 0}% (your own rate)`;
    } else {
      const result = FEE_RULES[channel](gross, category, subcategory);
      fees = result.total;
      feeSummary = result.summary;
      status = result.status;
      source = result.source;
      caveat = result.caveat ?? "";
    }
    const net = gross - fees - shipCost;
    const gain = net - Number(costBasis ?? 0);
    return { gross, shipCost, shippingEntered, fees, feeSummary, net, gain, status, source, caveat };
  }, [salePrice, shipping, channel, customRate, override, category, subcategory, costBasis]);

  const hasPrice = payout.gross > 0;

  return (
    <section aria-label="Cost to sell" className="rounded-[18px] bg-[color:var(--surface)] px-4 py-3 ring-1 ring-[color:var(--border)]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <div className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--muted2)]">Cost to Sell</div>
        <div className="text-[11px] text-[color:var(--muted)]">Try first: <span className="font-semibold text-[color:var(--theme-gold)]">{CHANNEL_LABEL[advice.suggested]}</span></div>
      </div>

      <div className="mt-2 grid gap-x-3 gap-y-2 sm:grid-cols-[minmax(0,160px)_minmax(0,160px)_1fr]">
        <label className="grid gap-1">
          <span className={LABEL}>Sale price</span>
          <input value={salePrice} onChange={(e) => setSalePrice(e.target.value)} className={INPUT} inputMode="decimal" placeholder="What you expect" />
        </label>
        <label className="grid gap-1">
          <span className={LABEL}>Estimated outbound shipping</span>
          <input value={shipping} onChange={(e) => setShipping(e.target.value)} className={INPUT} inputMode="decimal" placeholder="Postage to the buyer (0 if free)" aria-label="Estimated outbound shipping" />
        </label>
        <div className="grid gap-1">
          <span className={LABEL}>Marketplace</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {allowed.map((id) => (
              <PillButton key={id} size="compact" variant={channel === id ? "active" : "default"} pressed={channel === id} onClick={() => setPicked(id)}>
                {CHANNEL_LABEL[id]}
              </PillButton>
            ))}
            {channel === "custom" ? (
              <input
                value={customRate}
                onChange={(e) => setCustomRate(e.target.value)}
                className="h-8 w-24 rounded-lg bg-[color:var(--pill)] px-2 text-sm ring-1 ring-[color:var(--border)] focus:outline-none max-md:h-11"
                inputMode="decimal"
                aria-label="Custom fee percent"
                placeholder="Fee %"
              />
            ) : (
              <input
                value={override}
                onChange={(e) => setOverride(e.target.value)}
                className="h-8 w-36 rounded-lg bg-[color:var(--pill)] px-2 text-sm ring-1 ring-[color:var(--border)] focus:outline-none max-md:h-11"
                inputMode="decimal"
                aria-label="Override fee percent (optional)"
                placeholder="Override fee %"
              />
            )}
          </div>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-[color:var(--border)] pt-2.5 sm:grid-cols-5">
        <div>
          <dt className={LABEL}>Gross</dt>
          <dd className="text-base font-semibold">{money(payout.gross)}</dd>
        </div>
        <div>
          <dt className={LABEL}>Fees</dt>
          <dd className="text-base font-semibold">{hasPrice ? money(payout.fees) : "—"}</dd>
        </div>
        <div>
          <dt className={LABEL}>Outbound shipping</dt>
          <dd className="text-base font-semibold">{payout.shippingEntered ? (payout.shipCost === 0 ? "Free ($0)" : money(payout.shipCost)) : "Not entered"}</dd>
        </div>
        <div>
          <dt className={LABEL}>Net</dt>
          <dd className="text-base font-semibold">{hasPrice ? money(payout.net) : "—"}</dd>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <dt className={LABEL}>Net gain / loss</dt>
          <dd className={["text-base font-semibold", !hasPrice ? "" : payout.gain >= 0 ? "text-emerald-300" : "text-red-300"].join(" ")}>
            {hasPrice ? `${payout.gain >= 0 ? "+" : ""}${money(payout.gain)}` : "—"}
            <span className="ml-2 text-[11px] font-normal text-[color:var(--muted)]">Cost basis {money(Number(costBasis ?? 0))}</span>
          </dd>
        </div>
      </dl>

      {hasPrice ? (
        <p className="mt-2 text-[11px] leading-snug text-[color:var(--muted)]" data-testid="cost-to-sell-shipping-note">
          {payout.shippingEntered
            ? `Net = sale price − fees − the ${payout.shipCost === 0 ? "free (\$0)" : "outbound"} shipping you entered. Net gain / loss then subtracts the cost basis (${money(Number(costBasis ?? 0))}), which already includes what you paid for tax, shipping and fees when you bought it, so nothing is counted twice.`
            : `No outbound shipping was entered, so this net does NOT include postage to the buyer (type 0 if shipping is free). The cost basis (${money(Number(costBasis ?? 0))}) already includes what you paid for shipping when you bought it; that is not postage to the buyer and is not added again here.`}
        </p>
      ) : null}
      <p className="mt-2 text-[11px] leading-snug text-[color:var(--muted)]">
        {hasPrice ? (
          <>
            Fees used: {payout.feeSummary}.{" "}
            {payout.status === "verified" ? (
              <>Read from {payout.source}, October 2026. Marketplaces change their fees, so confirm in your seller account. </>
            ) : payout.status === "partly" ? (
              <>
                <b className="text-[color:var(--fg)]">Unverified in part:</b> {payout.caveat} Source for the rest: {payout.source}. If you know your rate, type it in Override fee % (it replaces the whole fee, fixed per-order charge included).{" "}
              </>
            ) : (
              <>This is your own rate; nothing here was checked against the marketplace. </>
            )}
          </>
        ) : (
          "Type the price you expect to sell it for. Each marketplace's rate shows whether it was read from its own page or is an unverified estimate; Override fee % replaces the marketplace's whole fee, fixed per-order charge included, with your own percentage of the sale price. "
        )}
        {advice.note}
      </p>
    </section>
  );
}
