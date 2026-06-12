/**
 * auctionLib.ts
 * Supabase queries and helpers for auction functionality.
 *
 * Database tables (see migration: supabase/migrations/20260610_auction_bids.sql):
 *   vault_items  — extended with auction columns (status = 'AUCTION', auctionStatus, etc.)
 *   bids         — id, item_id, bidder_id, amount, created_at
 */

import { getSupabaseBrowserClient } from "./supabaseClient";
import type { VaultItem } from "./vaultModel";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AuctionItem = Omit<VaultItem, "status" | "auctionStatus" | "auctionEndsAt" | "auctionStartingBid" | "auctionCurrentBid" | "auctionBidCount" | "auctionWinnerId" | "reservePrice" | "buyItNowPrice"> & {
  status: "AUCTION";
  auctionStatus: "ACTIVE" | "ENDED" | "CANCELLED";
  auctionEndsAt: number;           // unix ms
  auctionStartingBid: number;
    auctionCurrentBid?: number;
    auctionBidCount?: number;
    auctionWinnerId?: string;
    reservePrice?: number;
    buyItNowPrice?: number;
};

export type Bid = {
  id: string;
  itemId: string;
  bidderId: string;
  bidderDisplayName?: string;
  amount: number;
  createdAt: number; // unix ms
};

export type PlaceBidResult =
  | { ok: true; bid: Bid }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rowToAuctionItem(row: Record<string, unknown>): AuctionItem {
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    status: "AUCTION",
    auctionStatus: (row.auction_status as "ACTIVE" | "ENDED" | "CANCELLED") ?? "ACTIVE",
    auctionEndsAt: Number(row.auction_ends_at) || 0,
    auctionStartingBid: Number(row.auction_starting_bid) || 0,
    auctionCurrentBid: row.auction_current_bid != null ? Number(row.auction_current_bid) : undefined,
    auctionBidCount: row.auction_bid_count != null ? Number(row.auction_bid_count) : 0,
    auctionWinnerId: typeof row.auction_winner_id === "string" ? row.auction_winner_id : undefined,
    reservePrice: row.reserve_price != null ? Number(row.reserve_price) : undefined,
    buyItNowPrice: row.buy_it_now_price != null ? Number(row.buy_it_now_price) : undefined,
    universe: typeof row.universe === "string" ? row.universe : undefined,
    category: typeof row.category === "string" ? row.category : undefined,
    grade: typeof row.grade === "string" ? row.grade : undefined,
    imageFrontUrl: typeof row.image_front_url === "string" ? row.image_front_url : undefined,
    notes: typeof row.notes === "string" ? row.notes : undefined,
    profile_id: typeof row.profile_id === "string" ? row.profile_id : undefined,
  };
}

function rowToBid(row: Record<string, unknown>): Bid {
  return {
    id: String(row.id),
    itemId: String(row.item_id),
    bidderId: String(row.bidder_id),
    bidderDisplayName: typeof row.bidder_display_name === "string" ? row.bidder_display_name : undefined,
    amount: Number(row.amount),
    createdAt: row.created_at ? new Date(String(row.created_at)).getTime() : Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Fetch all active auctions (not ended, not cancelled). */
export async function fetchActiveAuctions(opts?: {
  universe?: string;
  limit?: number;
}): Promise<AuctionItem[]> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return [];

  const now = Date.now();
  let q = sb
    .from("vault_items")
    .select("*")
    .eq("status", "AUCTION")
    .eq("auction_status", "ACTIVE")
    .gt("auction_ends_at", now)
    .order("auction_ends_at", { ascending: true })
    .limit(opts?.limit ?? 60);

  if (opts?.universe) q = q.eq("universe", opts.universe);

  const { data, error } = await q;
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(rowToAuctionItem);
}

/** Fetch a single auction item by vault item id. */
export async function fetchAuctionItem(id: string): Promise<AuctionItem | null> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return null;

  const { data, error } = await sb
    .from("vault_items")
    .select("*")
    .eq("id", id)
    .eq("status", "AUCTION")
    .single();

  if (error || !data) return null;
  return rowToAuctionItem(data as Record<string, unknown>);
}

/** Fetch bid history for an item, newest first. */
export async function fetchBids(itemId: string, limit = 50): Promise<Bid[]> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return [];

  const { data, error } = await sb
    .from("bids")
    .select("*")
    .eq("item_id", itemId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(rowToBid);h
}

/** Place a bid. Enforces minimum increment server-side via RLS + DB function. */
export async function placeBid(
  itemId: string,
  amount: number
): Promise<PlaceBidResult> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return { ok: false, error: "Not connected" };

  const { data: userData } = await sb.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return { ok: false, error: "Sign in to bid" };

  // Verify auction is still active before inserting
  const item = await fetchAuctionItem(itemId);
  if (!item) return { ok: false, error: "Auction not found" };
  if (item.auctionStatus !== "ACTIVE") return { ok: false, error: "Auction has ended" };
  if (Date.now() > item.auctionEndsAt) return { ok: false, error: "Auction has expired" };

  const minBid = item.auctionCurrentBid
    ? item.auctionCurrentBid + 1
    : item.auctionStartingBid;
  if (amount < minBid) {
    return { ok: false, error: `Minimum bid is $${minBid.toFixed(2)}` };
  }

  const { data, error } = await sb
    .from("bids")
    .insert({ item_id: itemId, bidder_id: userId, amount })
    .select()
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Bid failed" };
  }

  return { ok: true, bid: rowToBid(data as Record<string, unknown>) };
}

// ---------------------------------------------------------------------------
// Realtime helpers
// ---------------------------------------------------------------------------

/** Subscribe to new bids on an item. Returns an unsubscribe function. */
export function subscribeToBids(
  itemId: string,
  onBid: (bid: Bid) => void
): () => void {
  const sb = getSupabaseBrowserClient();
  if (!sb) return () => {};

  const channel = sb
    .channel(`bids:${itemId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "bids", filter: `item_id=eq.${itemId}` },
      (payload) => {
        const bid = rowToBid(payload.new as Record<string, unknown>);
        onBid(bid);
      }
    )
    .subscribe();

  return () => {
    sb.removeChannel(channel);
  };
}

/** Subscribe to auction item updates (bid count, current bid, status). Returns an unsubscribe function. */
export function subscribeToAuctionItem(
  itemId: string,
  onUpdate: (item: AuctionItem) => void
): () => void {
  const sb = getSupabaseBrowserClient();
  if (!sb) return () => {};

  const channel = sb
    .channel(`auction_item:${itemId}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "vault_items", filter: `id=eq.${itemId}` },
      (payload) => {
        const item = rowToAuctionItem(payload.new as Record<string, unknown>);
        if (item.status === "AUCTION") onUpdate(item);
      }
    )
    .subscribe();

  return () => {
    sb.removeChannel(channel);
  };
}

// ---------------------------------------------------------------------------
// Countdown helper (pure, no Supabase needed)
// ---------------------------------------------------------------------------

export type CountdownResult = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
  label: string; // e.g. "2d 4h" or "14m 30s" or "Ended"
};

export function getAuctionCountdown(endsAt: number): CountdownResult {
  const remaining = endsAt - Date.now();
  if (remaining <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true, label: "Ended" };
  }

  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  let label: string;
  if (days >= 1) {
    label = `${days}d ${hours}h`;
  } else if (hours >= 1) {
    label = `${hours}h ${minutes}m`;
  } else {
    label = `${minutes}m ${seconds}s`;
  }

  return { days, hours, minutes, seconds, expired: false, label };
}
