"use client";

import { useState } from "react";
import { saveItem, type VaultItem } from "@/lib/vaultModel";

// ─── Countdown helper ─────────────────────────────────────────────────────────

export function useAuctionCountdown(endsAt?: number) {
  const now = Date.now();
  if (!endsAt || endsAt <= now) return null;
  const ms = endsAt - now;
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function AuctionCountdownChip({ item }: { item: VaultItem }) {
  if (item.auctionStatus !== "ACTIVE" || !item.auctionEndsAt) return null;
  const label = useAuctionCountdown(item.auctionEndsAt);
  if (!label) return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ring-1 ring-red-400/40"
      style={{ background: "rgba(239,68,68,0.15)", color: "rgb(252,165,165)" }}>
      ⏰ ENDED
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ring-1 ring-amber-400/40"
      style={{ background: "rgba(245,181,72,0.15)", color: "var(--theme-gold)" }}>
      ⏱ {label}
    </span>
  );
}

// ─── Duration options ─────────────────────────────────────────────────────────

const DURATIONS = [
  { label: "1 day",  hours: 24 },
  { label: "3 days", hours: 72 },
  { label: "7 days", hours: 168 },
  { label: "14 days", hours: 336 },
];

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

// ─── Component ────────────────────────────────────────────────────────────────

type Props = {
  item: VaultItem;
  onClose: () => void;
  onSaved?: (updated: VaultItem) => void;
};

export default function AuctionSetupSheet({ item, onClose, onSaved }: Props) {
  const isActive = item.auctionStatus === "ACTIVE";

  const [startingBid, setStartingBid] = useState(
    item.auctionStartingBid ? String(item.auctionStartingBid) : ""
  );
  const [reservePrice, setReservePrice] = useState(
    item.reservePrice ? String(item.reservePrice) : ""
  );
  const [buyItNow, setBuyItNow] = useState(
    item.buyItNowPrice ? String(item.buyItNowPrice) : ""
  );
  const [durationHours, setDurationHours] = useState(168);
  const [saving, setSaving] = useState(false);

  function handleStart() {
    const parsedStartingBid = startingBid ? Number(startingBid) : 1;
    setSaving(true);
    const endsAt = Date.now() + durationHours * 3600000;
    const updated: VaultItem = {
      ...item,
      status: "AUCTION",
      auctionStatus: "ACTIVE",
      auctionStartingBid: parsedStartingBid,
      auctionCurrentBid: undefined,
      auctionBidCount: 0,
      auctionWinnerId: undefined,
      reservePrice: reservePrice ? Number(reservePrice) : undefined,
      buyItNowPrice: buyItNow ? Number(buyItNow) : undefined,
      auctionEndsAt: endsAt,
    };
    saveItem(updated);
    window.dispatchEvent(new Event("vltd:vault-updated"));
    setSaving(false);
    onSaved?.(updated);
    onClose();
  }

  function handleCancel() {
    const updated: VaultItem = {
      ...item,
      status: "COLLECTION",
      auctionStatus: "CANCELLED",
      auctionEndsAt: undefined,
      auctionCurrentBid: undefined,
      auctionBidCount: 0,
      auctionWinnerId: undefined,
    };
    saveItem(updated);
    window.dispatchEvent(new Event("vltd:vault-updated"));
    onSaved?.(updated);
    onClose();
  }

  const endsAtLabel = isActive && item.auctionEndsAt
    ? new Date(item.auctionEndsAt).toLocaleString(undefined, {
        month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
      })
    : null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close"
      />

      <div
        className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden ring-1 ring-[color:var(--border)] shadow-2xl"
        style={{ background: "var(--surface)" }}
      >
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="h-1 w-12 rounded-full bg-[color:var(--border)]" />
        </div>

        <div className="px-5 pb-8 pt-4 flex flex-col gap-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                {isActive ? "Active Auction" : "Start Auction"}
              </div>
              <div className="mt-0.5 text-base font-bold line-clamp-1" style={{ color: "var(--fg)" }}>
                {item.title}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-lg leading-none"
              style={{ background: "var(--pill)", color: "var(--muted)" }}
            >
              ✕
            </button>
          </div>

          {/* Active state */}
          {isActive && endsAtLabel && (
            <div
              className="rounded-2xl px-4 py-3 ring-1 ring-amber-400/30"
              style={{ background: "rgba(245,181,72,0.1)" }}
            >
              <div className="text-xs font-semibold" style={{ color: "var(--theme-gold)" }}>
                🔴 LIVE — Ends {endsAtLabel}
              </div>
              {item.auctionStartingBid != null && (
                <div className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                  Starting bid: <strong style={{ color: "var(--fg)" }}>{fmt(item.auctionStartingBid)}</strong>
                </div>
              )}
              {item.auctionCurrentBid != null && (
                <div className="text-xs" style={{ color: "var(--muted)" }}>
                  Current bid: <strong style={{ color: "var(--theme-gold)" }}>{fmt(item.auctionCurrentBid)}</strong>
                  {item.auctionBidCount ? ` (${item.auctionBidCount} bid${item.auctionBidCount !== 1 ? "s" : ""})` : ""}
                </div>
              )}
              {item.reservePrice && (
                <div className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                  Reserve: <strong style={{ color: "var(--fg)" }}>{fmt(item.reservePrice)}</strong>
                </div>
              )}
              {item.buyItNowPrice && (
                <div className="text-xs" style={{ color: "var(--muted)" }}>
                  Buy It Now: <strong style={{ color: "var(--theme-gold)" }}>{fmt(item.buyItNowPrice)}</strong>
                </div>
              )}
            </div>
          )}

          {/* Setup form (only shown when not active) */}
          {!isActive && (
            <>
              {/* Starting bid */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                  Starting Bid
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "var(--muted)" }}>$</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={startingBid}
                    onChange={(e) => setStartingBid(e.target.value)}
                    placeholder="e.g. 25"
                    className="w-full rounded-xl py-2.5 pl-7 pr-4 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
                    style={{ background: "var(--pill)", color: "var(--fg)" }}
                  />
                </div>
                <div className="mt-1 text-[10px]" style={{ color: "var(--muted)" }}>
                  Minimum opening bid — defaults to $1 if left blank
                </div>
              </div>

              {/* Reserve price */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                  Reserve Price (optional)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "var(--muted)" }}>$</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={reservePrice}
                    onChange={(e) => setReservePrice(e.target.value)}
                    placeholder="Minimum acceptable price"
                    className="w-full rounded-xl py-2.5 pl-7 pr-4 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
                    style={{ background: "var(--pill)", color: "var(--fg)" }}
                  />
                </div>
                <div className="mt-1 text-[10px]" style={{ color: "var(--muted)" }}>
                  Auction won&apos;t complete unless bidding exceeds this amount
                </div>
              </div>

              {/* Buy It Now */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                  Buy It Now Price (optional)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "var(--muted)" }}>$</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={buyItNow}
                    onChange={(e) => setBuyItNow(e.target.value)}
                    placeholder="Instant purchase price"
                    className="w-full rounded-xl py-2.5 pl-7 pr-4 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
                    style={{ background: "var(--pill)", color: "var(--fg)" }}
                  />
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                  Duration
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {DURATIONS.map((d) => (
                    <button
                      key={d.hours}
                      type="button"
                      onClick={() => setDurationHours(d.hours)}
                      className="rounded-xl py-2 text-center text-sm font-semibold ring-1 transition"
                      style={{
                        background: durationHours === d.hours ? "var(--theme-gold)" : "var(--pill)",
                        color: durationHours === d.hours ? "#0B0B0B" : "var(--fg)",
                      }}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
                <div className="mt-2 text-[11px]" style={{ color: "var(--muted)" }}>
                  Ends:{" "}
                  {new Date(Date.now() + durationHours * 3600000).toLocaleString(undefined, {
                    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                  })}
                </div>
              </div>
            </>
          )}

          {/* Note */}
          <div
            className="rounded-xl px-3 py-2.5 text-[11px] ring-1 ring-[color:var(--border)]"
            style={{ background: "var(--pill)", color: "var(--muted)" }}
          >
            <strong style={{ color: "var(--fg)" }}>Live auction.</strong> Your item will appear on the VLTD Auctions page. Bidders must be signed in. Payments are arranged directly between buyer and seller.
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            {isActive ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-2xl py-3 text-sm font-semibold ring-1 ring-[color:var(--border)]"
                  style={{ background: "var(--pill)", color: "var(--fg)" }}
                >
                  Keep Running
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded-2xl px-5 py-3 text-sm font-bold ring-1 ring-red-400/30"
                  style={{ background: "rgba(239,68,68,0.15)", color: "rgb(252,165,165)" }}
                >
                  Cancel Auction
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-2xl px-4 py-3 text-sm font-semibold ring-1 ring-[color:var(--border)]"
                  style={{ background: "var(--pill)", color: "var(--fg)" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleStart}
                  disabled={saving}
                  className="flex-1 rounded-2xl py-3 text-sm font-bold transition"
                  style={{ background: "var(--theme-gold)", color: "#0B0B0B", opacity: saving ? 0.6 : 1 }}
                >
                  {saving ? "Starting…" : "Start Auction"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
