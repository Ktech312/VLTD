import Stripe from "stripe";

/**
 * Server-only Stripe helpers. Nothing here runs unless STRIPE_SECRET_KEY is
 * set - every caller checks isStripeConfigured() first and returns a clear
 * "not configured" response instead of throwing, so the UI can show an
 * honest state rather than a fake success or a crash.
 */

let cachedClient: Stripe | null = null;

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripeClient(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  if (!cachedClient) {
    cachedClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return cachedClient;
}

export type BillingPlan = "pro" | "business";

export function getStripePriceId(plan: BillingPlan): string | undefined {
  if (plan === "business") return process.env.STRIPE_PRICE_ID_BUSINESS;
  return process.env.STRIPE_PRICE_ID_PRO;
}

/** Map a billing plan to the app's subscription tier. */
export function tierForPlan(plan: BillingPlan): "MID" | "FULL" {
  return plan === "business" ? "FULL" : "MID";
}

/** Reverse-map a Stripe price id back to the app's tier (for webhooks). */
export function tierForPriceId(priceId?: string | null): "MID" | "FULL" | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_ID_BUSINESS) return "FULL";
  if (priceId === process.env.STRIPE_PRICE_ID_PRO) return "MID";
  return null;
}
