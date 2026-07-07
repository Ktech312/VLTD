import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripeClient, isStripeConfigured, tierForPriceId } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";

/**
 * Stripe webhook → app tier.
 *
 * Keeps profiles.tier in sync with the customer's subscription:
 *   • checkout.session.completed          → grant the purchased tier
 *   • customer.subscription.updated       → grant / downgrade based on status
 *   • customer.subscription.deleted       → revert to FREE
 *
 * The profile being billed is carried in the subscription's metadata.profile_id
 * (set by the checkout route). Coupons and admin comps write the same tier
 * column, so all three sources coexist.
 *
 * Setup: point a Stripe webhook at /api/billing/webhook and set
 * STRIPE_WEBHOOK_SECRET. Uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function applyTier(profileId: string, tier: "FREE" | "MID" | "FULL", expiresAt: string | null) {
  const sb = serviceClient();
  if (!sb || !profileId) return;
  await sb
    .from("profiles")
    .update({ tier, tier_source: "stripe", tier_expires_at: expiresAt })
    .eq("id", profileId);
  await sb
    .from("tier_changes")
    .insert({ profile_id: profileId, new_tier: tier, source: "stripe", reason: "stripe webhook" });
}

function periodEndIso(sub: Stripe.Subscription): string | null {
  const end = (sub as unknown as { current_period_end?: number }).current_period_end;
  return end ? new Date(end * 1000).toISOString() : null;
}

export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "no_webhook_secret" }, { status: 503 });

  const stripe = getStripeClient();
  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    return NextResponse.json(
      { error: "bad_signature", message: err instanceof Error ? err.message : "Invalid signature." },
      { status: 400 }
    );
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const profileId = (session.metadata?.profile_id || session.client_reference_id || "") as string;
      if (session.subscription && profileId) {
        const sub = await stripe.subscriptions.retrieve(String(session.subscription));
        const tier = tierForPriceId(sub.items.data[0]?.price?.id);
        if (tier) await applyTier(profileId, tier, periodEndIso(sub));
      }
    } else if (event.type === "customer.subscription.updated") {
      const sub = event.data.object as Stripe.Subscription;
      const profileId = (sub.metadata?.profile_id || "") as string;
      if (profileId) {
        const active = sub.status === "active" || sub.status === "trialing";
        const tier = tierForPriceId(sub.items.data[0]?.price?.id);
        await applyTier(profileId, active && tier ? tier : "FREE", active ? periodEndIso(sub) : null);
      }
    } else if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      const profileId = (sub.metadata?.profile_id || "") as string;
      if (profileId) await applyTier(profileId, "FREE", null);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    return NextResponse.json(
      { error: "handler_error", message: err instanceof Error ? err.message : "Webhook handler failed." },
      { status: 500 }
    );
  }
}
