"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  fetchAuctionItem,
  fetchBids,
  placeBid,
  subscribeToBids,
  subscribeToAuctionItem,
  getAuctionCountdown,
  type AuctionItem,
  type Bid,
  type CountdownResult,
} from "@/lib/auctionLib";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { getPrimaryImageUrl } from "@/lib/vaultModel";
import { UNIVERSE_LABEL, type UniverseKey } from "@/lib/taxonomy";
import ProgressiveImage from "@/components/ui/ProgressiveImage";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtFull(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n);
}

function fmtTime(ts: number) {
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function parseGradingService(grade?: string) {
  if (!grade) return null;
  const g = grade.toUpperCase();
  if (g.startsWith("PSA"))  return { service: "PSA",  color: "#60a5fa", bg: "rgba(96,165,250,0.12)" };
  if (g.startsWith("BGS") || g.startsWith("BECKETT")) return { service: "BGS", color: "#34d399", bg: "rgba(52,211,153,0.12)" };
  if (g.startsWith("SGC"))  return { service: "SGC",  color: "#fb923c", bg: "rgba(251,146,60,0.12)" };
  if (g.startsWith("CGC"))  return { service: "CGC",  color: "#c084fc", bg: "rgba(192,132,252,0.12)" };
  if (g.startsWith("CSG"))  return { service: "CSG",  color: "#f472b6", bg: "rgba(244,114,182,0.12)" };
  if (/RAW|UNGRADED|NONE/i.test(g)) return { service: "Raw", color: "#94a3b8", bg: "rgba(148,163,184,0.10)" };
  return null;
}

// ── Countdown display ─────────────────────────────────────────────────────────

function CountdownDisplay({ cd }: { cd: CountdownResult }) {
  if (cd.expired) {
    return (
      <div className="text-center">
        <div className="text-3xl font-bold" style={{ color: "#f87171" }}>Auction Ended</div>
      </div>
    );
  }

  const urgent = cd.days === 0 && cd.hours === 0;
  const soon   = cd.days === 0 && cd.hours < 4;
  const color  = urgent ? "#f87171" : soon ? "#fb923c" : "var(--theme-gold)";

  const units = cd.days > 0
    ? [
        { v: cd.days,    l: "Days" },
        { v: cd.hours,   l: "Hours" },
        { v: cd.minutes, l: "Min" },
      ]
    : [
        { v: cd.hours,   l: "Hours" },
        { v: cd.minutes, l: "Min" },
        { v: cd.seconds, l: "Sec" },
      ];

  return (
    <div className="flex items-end gap-3 justify-center">
      {units.map(({ v, l }, i) => (
        <div key={l} className="flex items-end gap-1">
          {i > 0 && (
            <span className="text-2xl font-bold mb-1 leading-none" style={{ color, opacity: 0.4 }}>:</span>
          )}
          <div className="text-center">
            <div
              className="text-4xl font-bold tabular-nums leading-none"
              style={{ color, fontVariantNumeric: "tabular-nums" }}
            >
              {String(v).padStart(2, "0")}
            </div>
            <div className="text-[10px] uppercase tracking-wide mt-1" style={{ color: "var(--muted)" }}>
              {l}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Bid row ───────────────────────────────────────────────────────────────────

function BidRow({ bid, isHighest }: { bid: Bid; isHighest: boolean }) {
  return (
    <div
      className="flex items-center justify-between px-3 py-2 rounded-xl"
      style={{
        background: isHighest ? "rgba(245,181,72,0.07)" : "transparent",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div className="flex items-center gap-2">
        {isHighest && (
          <span className="text-xs font-bold" style={{ color: "var(--theme-gold)" }}>👑</span>
        )}
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          {bid.bidderDisplayName ?? `Bidder #${bid.bidderId.slice(-4)}`}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold" style={{ color: isHighest ? "var(--theme-gold)" : "var(--fg)" }}>
          {fmtFull(bid.amount)}
        </span>
        <span className="text-[10px]" style={{ color: "var(--muted)" }}>
          {fmtTime(bid.createdAt)}
        </span>
      </div>
    </div>
  );
}

// ── Place bid panel ───────────────────────────────────────────────────────────

function PlaceBidPanel({
  item,
  onBidPlaced,
}: {
  item: AuctionItem;
  onBidPlaced: (bid: Bid) => void;
}) {
  const [userId, setUserId] = useState<string | null>(null);
  const [input, setInput]   = useState("");
  const [busy, setBusy]     = useState(false);
  const [msg, setMsg]       = useState<{ text: string; ok: boolean } | null>(null);

  const minBid = (item.auctionCurrentBid != null
    ? item.auctionCurrentBid + 1
    : item.auctionStartingBid) ?? 1;

  useEffect(() => {
    const sb = getSupabaseBrowserClient();
    if (!sb) return;
    sb.auth.getUser().then(({ data }) => setUserId(data?.user?.id ?? null));
  }, []);

  const handleBid = async () => {
    const amount = parseFloat(input.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(amount) || amount < minBid) {
      setMsg({ text: `Minimum bid is ${fmtFull(minBid)}`, ok: false });
      return;
    }
    setBusy(true);
    setMsg(null);
    const result = await placeBid(item.id, amount);
    setBusy(false);
    if (result.ok) {
      setMsg({ text: `Bid of ${fmtFull(amount)} placed!`, ok: true });
      setInput("");
      onBidPlaced(result.bid);
    } else {
      setMsg({ text: result.error, ok: false });
    }
  };

  if (item.auctionStatus !== "ACTIVE" || getAuctionCountdown(item.auctionEndsAt).expired) {
    return (
      <div
        className="rounded-2xl p-4 text-center text-sm"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)" }}
      >
        This auction has ended.
      </div>
    );
  }

  if (!userId) {
    return (
      <div
        className="rounded-2xl p-4 text-center text-sm"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <span style={{ color: "var(--muted)" }}>Sign in to place a bid — </span>
        <Link href="/login" className="underline" style={{ color: "var(--theme-gold)" }}>
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
        Place a Bid
      </div>

      <div className="text-xs" style={{ color: "var(--muted)" }}>
        Minimum: <strong style={{ color: "var(--fg)" }}>{fmtFull(minBid)}</strong>
      </div>

      <div className="flex gap-2">
        <div
          className="flex-1 flex items-center rounded-xl px-3 ring-1 ring-[color:var(--border)]"
          style={{ background: "var(--pill)" }}
        >
          <span className="text-sm mr-1" style={{ color: "var(--muted)" }}>$</span>
          <input
            type="number"
            min={minBid}
            step="1"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleBid()}
            placeholder={String(minBid)}
            className="flex-1 bg-transparent py-2 text-sm focus:outline-none"
            style={{ color: "var(--fg)" }}
          />
        </div>
        <button
          onClick={handleBid}
          disabled={busy}
          className="rounded-xl px-5 py-2 text-sm font-bold transition active:scale-95 disabled:opacity-50"
          style={{ background: "var(--theme-gold)", color: "#0B0B0B" }}
        >
          {busy ? "…" : "Bid"}
        </button>
      </div>

      {msg && (
        <div
          className="text-xs rounded-lg px-3 py-2"
          style={{
            background: msg.ok ? "rgba(52,211,153,0.10)" : "rgba(239,68,68,0.10)",
            color: msg.ok ? "#34d399" : "#f87171",
          }}
        >
          {msg.text}
        </div>
      )}

      {item.buyItNowPrice && (
        <button
          disabled={busy}
          onClick={async () => {
            setInput(String(item.buyItNowPrice));
            const result = await placeBid(item.id, item.buyItNowPrice!);
            if (result.ok) {
              setMsg({ text: `Bought now for ${fmtFull(item.buyItNowPrice!)}!`, ok: true });
              onBidPlaced(result.bid);
            } else {
              setMsg({ text: result.error, ok: false });
            }
          }}
          className="w-full rounded-xl py-2 text-sm font-semibold ring-1 ring-[color:var(--theme-gold)] transition hover:bg-[rgba(245,181,72,0.08)]"
          style={{ color: "var(--theme-gold)" }}
        >
          Buy Now — {fmt(item.buyItNowPrice)}
        </button>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AuctionItemPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";

  const [item, setItem]     = useState<AuctionItem | null>(null);
  const [bids, setBids]     = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [cd, setCd]         = useState<CountdownResult>({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: false, label: "" });

  // Countdown tick
  useEffect(() => {
    if (!item) return;
    const update = () => setCd(getAuctionCountdown(item.auctionEndsAt));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [item]);

  // Initial load
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([fetchAuctionItem(id), fetchBids(id)])
      .then(([auctionItem, bidList]) => {
        if (!auctionItem) { setNotFound(true); setLoading(false); return; }
        setItem(auctionItem);
        setBids(bidList);
        setLoading(false);
      })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [id]);

  // Realtime subscriptions
  useEffect(() => {
    if (!id) return;
    const unsub1 = subscribeToBids(id, (newBid) => {
      setBids((prev) => [newBid, ...prev]);
    });
    const unsub2 = subscribeToAuctionItem(id, (updatedItem) => {
      setItem(updatedItem);
    });
    return () => { unsub1(); unsub2(); };
  }, [id]);

  const onBidPlaced = useCallback((bid: Bid) => {
    setBids((prev) => {
      // Avoid duplicate if realtime already delivered it
      if (prev.some((b) => b.id === bid.id)) return prev;
      return [bid, ...prev];
    });
    // Optimistically update current bid
    setItem((prev) =>
      prev
        ? {
            ...prev,
            auctionCurrentBid: bid.amount,
            auctionBidCount: (prev.auctionBidCount ?? 0) + 1,
          }
        : prev
    );
  }, []);

  // ── Render states ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="text-sm" style={{ color: "var(--muted)" }}>Loading auction…</div>
      </div>
    );
  }

  if (notFound || !item) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: "var(--bg)" }}>
        <div className="text-4xl">🔨</div>
        <div className="text-base font-semibold" style={{ color: "var(--fg)" }}>Auction not found</div>
        <Link href="/auction" className="text-sm underline" style={{ color: "var(--theme-gold)" }}>
          Browse all auctions
        </Link>
      </div>
    );
  }

  const imageUrl = getPrimaryImageUrl(item);
  const universeLabel = UNIVERSE_LABEL[item.universe as UniverseKey] ?? item.universe ?? "";
  const gradingSvc = parseGradingService(item.grade);
  const currentBid = item.auctionCurrentBid ?? item.auctionStartingBid;
  const bidCount = item.auctionBidCount ?? 0;
  const highestBid = bids[0];

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Breadcrumb */}
      <div
        className="border-b border-[color:var(--border)] px-4 py-3"
        style={{ background: "var(--surface)" }}
      >
        <div className="mx-auto max-w-6xl flex items-center gap-2 text-sm">
          <Link href="/" style={{ color: "var(--muted)" }}>VLTD</Link>
          <span style={{ color: "var(--muted)" }}>/</span>
          <Link href="/auction" style={{ color: "var(--muted)" }}>Auctions</Link>
          <span style={{ color: "var(--muted)" }}>/</span>
          <span
            className="truncate max-w-[200px]"
            style={{ color: "var(--fg)" }}
          >
            {item.title}
          </span>
        </div>
      </div>

      {/* Main content */}
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* ── Left: photo + countdown ── */}
          <div className="flex flex-col gap-6">
            {/* Photo */}
            <div
              className="relative rounded-2xl overflow-hidden aspect-square w-full max-w-lg mx-auto"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              {imageUrl ? (
                <ProgressiveImage
                  src={imageUrl}
                  alt={item.title}
                  className="h-full w-full"
                  imageClassName="object-contain object-center"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-6xl opacity-20">🏷️</div>
              )}
            </div>

            {/* Countdown card */}
            <div
              className="rounded-2xl p-6 text-center"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--muted)" }}>
                {cd.expired ? "Auction Status" : "Time Remaining"}
              </div>
              <CountdownDisplay cd={cd} />
              {!cd.expired && (
                <div className="mt-3 text-xs" style={{ color: "var(--muted)" }}>
                  Ends {fmtTime(item.auctionEndsAt)}
                </div>
              )}
            </div>
          </div>

          {/* ── Right: info + bid ── */}
          <div className="flex flex-col gap-5">
            {/* Title block */}
            <div>
              {universeLabel && (
                <div className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--muted)" }}>
                  {universeLabel}
                </div>
              )}
              <h1 className="text-2xl font-bold leading-tight" style={{ color: "var(--fg)" }}>
                {item.title}
              </h1>

              {/* Chips */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {gradingSvc ? (
                  <span
                    className="rounded-full px-3 py-1 text-xs font-bold"
                    style={{ background: gradingSvc.bg, color: gradingSvc.color }}
                  >
                    {item.grade}
                  </span>
                ) : item.grade ? (
                  <span
                    className="rounded-full px-3 py-1 text-xs font-semibold"
                    style={{ background: "var(--pill)", color: "var(--theme-gold)" }}
                  >
                    {item.grade}
                  </span>
                ) : null}
                {item.certNumber && (
                  <span
                    className="rounded-full px-3 py-1 text-xs font-semibold"
                    style={{ background: "rgba(245,181,72,0.08)", color: "var(--theme-gold)" }}
                  >
                    ✓ Certified · {item.certNumber}
                  </span>
                )}
              </div>
            </div>

            {/* Bid stats */}
            <div
              className="rounded-2xl p-4 grid grid-cols-2 gap-4"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div>
                <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                  {bidCount === 0 ? "Starting Bid" : "Current Bid"}
                </div>
                <div className="text-3xl font-bold mt-0.5" style={{ color: "var(--theme-gold)" }}>
                  {fmt(currentBid)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>Total Bids</div>
                <div className="text-3xl font-bold mt-0.5" style={{ color: "var(--fg)" }}>
                  {bidCount}
                </div>
              </div>
              {item.reservePrice && (
                <div>
                  <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>Reserve</div>
                  <div className="text-sm font-semibold mt-0.5" style={{ color: "var(--fg)" }}>
                    {item.reservePrice <= (item.auctionCurrentBid ?? 0)
                      ? <span style={{ color: "#34d399" }}>✓ Met</span>
                      : <span style={{ color: "var(--muted)" }}>Not met</span>}
                  </div>
                </div>
              )}
            </div>

            {/* Bid form */}
            <PlaceBidPanel item={item} onBidPlaced={onBidPlaced} />

            {/* Notes */}
            {item.notes && (
              <div
                className="rounded-2xl p-4"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--muted)" }}>
                  Description
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "var(--fg)" }}>
                  {item.notes}
                </p>
              </div>
            )}

            {/* Bid history */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="px-4 py-3 border-b border-[color:var(--border)] flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                  Bid History
                </div>
                <div className="text-xs" style={{ color: "var(--muted)" }}>
                  {bids.length} bid{bids.length !== 1 ? "s" : ""}
                </div>
              </div>

              {bids.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--muted)" }}>
                  No bids yet — be the first!
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto">
                  {bids.map((bid, i) => (
                    <BidRow key={bid.id} bid={bid} isHighest={i === 0} />
                  ))}
                </div>
              )}
            </div>

            {/* Back link */}
            <Link
              href="/auction"
              className="text-sm text-center"
              style={{ color: "var(--muted)" }}
            >
              ← Browse all auctions
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
