import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripeClient, isStripeConfigured, tierForPriceId } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

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

// Stripe's `customer` field on both a Checkout Session and a Subscription is
// either a bare id string or an expanded object, depending on the API call --
// this normalizes either shape to just the id.
function customerIdFrom(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined
): string | undefined {
  if (!customer) return undefined;
  return typeof customer === "string" ? customer : customer.id;
}

async function applyTier(
  profileId: string,
  tier: "FREE" | "MID" | "FULL",
  expiresAt: string | null,
  customerId: string | undefined,
  event: Pick<Stripe.Event, "id" | "created">
) {
  const sb = serviceClient();
  if (!sb) throw new Error("Billing database is not configured.");
  if (!profileId) return;
  const update: Record<string, unknown> = { tier, tier_source: "stripe", tier_expires_at: expiresAt };
  if (customerId) update.stripe_customer_id = customerId;

  let { error } = await sb.from("profiles").update(update).eq("id", profileId);
  if (error && customerId && error.message.toLowerCase().includes("stripe_customer_id")) {
    // 20260812_profiles_stripe_customer_id.sql not run yet -- retry without
    // it so tier sync (the part that already worked) doesn't start failing
    // because of an unrelated, not-yet-run migration.
    delete update.stripe_customer_id;
    ({ error } = await sb.from("profiles").update(update).eq("id", profileId));
  }
  // A tier that could not be stored must not be answered with success: the failure goes back to Stripe, which retries the event.
  if (error) throw new Error(`Could not store the ${tier} tier: ${error.message}`);

  // A tier write can succeed while its audit write fails. Always finish the audit on retry,
  // using the existing UUID primary key to make sequential/concurrent deliveries idempotent.
  // This records subscription synchronization, including renewals that retain the same tier.
  const bytes = createHash("sha256").update(`vltd:stripe:${event.id}:${profileId}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x80;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  const { error: logError } = await sb.from("tier_changes").upsert({
    id,
    profile_id: profileId,
    new_tier: tier,
    source: "stripe",
    reason: `Stripe subscription synchronized: ${event.id}`,
    changed_at: new Date(event.created * 1000).toISOString(),
  }, { onConflict: "id" });
  if (logError) throw new Error(`Could not record the subscription synchronization: ${logError.message}`);
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

  if (!event.id || !Number.isFinite(event.created)) {
    return NextResponse.json({ error: "invalid_event", message: "Missing Stripe event identity." }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const profileId = (session.metadata?.profile_id || session.client_reference_id || "") as string;
      if (session.subscription && profileId) {
        const sub = await stripe.subscriptions.retrieve(String(session.subscription));
        const tier = tierForPriceId(sub.items.data[0]?.price?.id);
        const active = sub.status === "active" || sub.status === "trialing";
        if (tier) await applyTier(profileId, active ? tier : "FREE", active ? periodEndIso(sub) : null, customerIdFrom(session.customer), event);
      }
    } else if (event.type === "customer.subscription.updated") {
      const eventSub = event.data.object as Stripe.Subscription;
      // The subscription as Stripe has it now, not as it was when this event was written: a late or replayed older event cannot put back an older state.
      const sub = eventSub?.id ? await stripe.subscriptions.retrieve(eventSub.id) : eventSub;
      const profileId = (sub.metadata?.profile_id || eventSub.metadata?.profile_id || "") as string;
      if (profileId) {
        const active = sub.status === "active" || sub.status === "trialing";
        const tier = tierForPriceId(sub.items.data[0]?.price?.id);
        await applyTier(
          profileId,
          active && tier ? tier : "FREE",
          active ? periodEndIso(sub) : null,
          customerIdFrom(sub.customer),
          event
        );
      }
    } else if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      const profileId = (sub.metadata?.profile_id || "") as string;
      if (profileId) await applyTier(profileId, "FREE", null, customerIdFrom(sub.customer), event);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    return NextResponse.json(
      { error: "handler_error", message: err instanceof Error ? err.message : "Webhook handler failed." },
      { status: 500 }
    );
  }
}
