// ONE strict rule for an amount of money typed by a person (a cost, a price, a value, an asking price, a bid, a sale price).
//
//   blank              = nothing entered: unknown / not set (never turned into 0)
//   0                  = an explicit zero (kept as 0)
//   1250 / 1,250.50    = the amount. Supported formats: an optional currency symbol ($ £ € ¥), digits, US thousands commas in
//                        groups of three, a period for cents (at most 2 decimals), and a leading minus or parentheses for a negative.
//   anything else      = refused with a plain message. Nothing is guessed: "1e3" is not 13, "1,5" is not 15, "5-3" is not blank,
//                        "abc" is not 0.
//
// Found by the audit (RC-17): the older helpers deleted every character that was not a digit, dot or minus, so letters became a
// blank or $0 under a green "Saved", "1e3" became 13 and "1,5" became 15. Existing saved records are never changed by this: it only
// checks what is being typed or saved now. Spreadsheet imports keep their own documented cleaning (src/lib/costInput.ts).

export const MONEY_MAX = 999_999_999.99;

export type MoneyParse =
  | { ok: true; blank: true; value: undefined }
  | { ok: true; blank: false; value: number }
  | { ok: false; message: string };

export type MoneyOptions = {
  /** Used in messages: "Purchase price", "Asking price", "Starting bid"... */
  label?: string;
  /** Prices, costs, values and bids are never negative; only a gain/loss style field would set this. */
  allowNegative?: boolean;
};

const SYMBOL = /^[$£€¥]/;

export function negativeMessage(label: string): string {
  return `${label} can't be negative. Leave it blank if you don't know it, or enter 0 if it's nothing.`;
}

export function parseMoneyInput(raw: unknown, opts: MoneyOptions = {}): MoneyParse {
  const label = opts.label ?? "That amount";
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return { ok: false, message: `${label} is not a number. Enter an amount like 25 or 1,250.50.` };
    if (raw < 0 && !opts.allowNegative) return { ok: false, message: negativeMessage(label) };
    if (Math.abs(raw) > MONEY_MAX) return { ok: false, message: `${label} is too large.` };
    return { ok: true, blank: false, value: Math.round(raw * 100) / 100 };
  }
  if (raw === undefined || raw === null) return { ok: true, blank: true, value: undefined };
  let text = String(raw).trim();
  if (text === "") return { ok: true, blank: true, value: undefined };

  let negative = false;
  if (/^\(.*\)$/.test(text)) { negative = true; text = text.slice(1, -1).trim(); }
  if (/^[-−–]/.test(text)) { negative = true; text = text.slice(1).trim(); }
  if (SYMBOL.test(text)) text = text.slice(1).trim();
  if (/^[-−–]/.test(text)) { negative = true; text = text.slice(1).trim(); } // "$-5"

  if (/^\d[\d,]*\.$/.test(text)) text = text.slice(0, -1); // "25." is just 25
  const bad = (reason: string): MoneyParse => ({ ok: false, message: `${label}: ${reason}` });
  if (text === "") return bad("enter an amount like 25 or 1,250.50.");
  if (/[a-zA-Z]/.test(text)) return bad("use numbers only (no letters or exponents like 1e3).");
  if (/[-−–]/.test(text)) return bad("enter one amount (a dash between numbers is not supported).");
  if (/\s/.test(text)) return bad("remove the spaces inside the number.");

  const plain = /^\d+(\.\d+)?$/;
  const grouped = /^\d{1,3}(,\d{3})+(\.\d+)?$/;
  const leadingDot = /^\.\d+$/;
  if (!plain.test(text) && !grouped.test(text) && !leadingDot.test(text)) {
    if (text.includes(",")) return bad("use a period for cents and commas only for thousands, like 1,250.50 (1,5 is not supported).");
    return bad("enter an amount like 25 or 1,250.50.");
  }
  const decimals = text.split(".")[1];
  if (decimals && decimals.length > 2) return bad("use at most 2 decimal places.");

  const value = Number(text.replace(/,/g, ""));
  if (!Number.isFinite(value)) return bad("enter an amount like 25 or 1,250.50.");
  if (value > MONEY_MAX) return bad("that is too large.");
  const signed = negative ? -value : value;
  if (signed < 0 && !opts.allowNegative) return { ok: false, message: negativeMessage(label) };
  // "-0" is an explicit zero, not a negative
  return { ok: true, blank: false, value: Math.round(Math.abs(signed) === 0 ? 0 : signed * 100) / 100 };
}

/** The first problem among several typed fields, in order; undefined when every field is blank or valid. */
export function firstMoneyProblem(fields: Array<{ raw: unknown; label: string }>): string | undefined {
  for (const f of fields) {
    const r = parseMoneyInput(f.raw, { label: f.label });
    if (!r.ok) return r.message;
  }
  return undefined;
}

/** Valid value or undefined (blank). Call only after the field has been checked: an invalid entry also gives undefined here. */
export function moneyOrUndefined(raw: unknown): number | undefined {
  const r = parseMoneyInput(raw);
  return r.ok && !r.blank ? r.value : undefined;
}

/** Quick Add: the cost and value typed for one item. */
export function draftMoneyProblem(d: { purchasePrice?: string; currentValue?: string }): string | undefined {
  return firstMoneyProblem([
    { raw: d.purchasePrice, label: "Cost" },
    { raw: d.currentValue, label: "Value" },
  ]);
}

const ITEM_MONEY_FIELDS: Array<[string, string]> = [
  ["purchasePrice", "Purchase price"], ["purchaseTax", "Tax"], ["purchaseShipping", "Shipping"], ["purchaseFees", "Fees"],
  ["currentValue", "Value"], ["estimatedValue", "Estimated value"], ["lastCompValue", "Last comparable"],
  ["valueLow", "Value range (low)"], ["valueMedian", "Value range (median)"], ["valueHigh", "Value range (high)"],
  ["askingPrice", "Asking price"], ["soldPrice", "Sold price"],
  ["auctionStartingBid", "Starting bid"], ["reservePrice", "Reserve price"], ["buyItNowPrice", "Buy It Now price"],
];

/**
 * The save-side check: an amount that CHANGED between `prev` and `next` must be a finite, non-negative number (blank, i.e. undefined, is fine).
 * Records that already hold something odd are not rewritten and never block an unrelated edit.
 */
export function itemMoneyProblem(prev: Record<string, unknown>, next: Record<string, unknown>): string | undefined {
  for (const [key, label] of ITEM_MONEY_FIELDS) {
    const after = next[key];
    if (after === undefined || after === null) continue;
    if (after === prev[key]) continue;
    if (typeof after !== "number" || !Number.isFinite(after)) return `${label} is not a valid amount, so nothing was saved.`;
    if (after < 0) return `${negativeMessage(label)} Nothing was saved.`;
  }
  return undefined;
}

export type AuctionPricesCheck =
  | { ok: true; startingBid: number; reservePrice?: number; buyItNowPrice?: number }
  | { ok: false; message: string };

/**
 * Auction prices: the starting bid is at least $1 (blank defaults to $1, as the sheet says); a reserve or Buy It Now may be blank or a
 * valid non-negative amount; Buy It Now cannot be below the reserve or below the starting bid.
 */
export function validateAuctionPrices(raw: { startingBid: string; reservePrice: string; buyItNow: string }): AuctionPricesCheck {
  const start = parseMoneyInput(raw.startingBid, { label: "Starting bid" });
  if (!start.ok) return start;
  const reserve = parseMoneyInput(raw.reservePrice, { label: "Reserve price" });
  if (!reserve.ok) return reserve;
  const bin = parseMoneyInput(raw.buyItNow, { label: "Buy It Now price" });
  if (!bin.ok) return bin;
  const startingBid = start.blank ? 1 : start.value;
  if (startingBid < 1) return { ok: false, message: "The starting bid must be at least $1 (leave it blank for $1)." };
  if (!bin.blank && !reserve.blank && bin.value < reserve.value) return { ok: false, message: "Buy It Now can't be lower than the reserve price." };
  if (!bin.blank && bin.value < startingBid) return { ok: false, message: "Buy It Now can't be lower than the starting bid." };
  return { ok: true, startingBid, reservePrice: reserve.blank ? undefined : reserve.value, buyItNowPrice: bin.blank ? undefined : bin.value };
}
