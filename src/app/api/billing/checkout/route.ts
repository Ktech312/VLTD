import { NextRequest, NextResponse } from "next/server";
import { getStripeClient, getStripePriceId, isStripeConfigured, tierForPlan, type BillingPlan } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "not_configured", message: "Stripe isn't connected yet — add STRIPE_SECRET_KEY to enable billing." },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const plan = body?.plan as BillingPlan | undefined;
  const customerEmail = typeof body?.customerEmail === "string" ? body.customerEmail : undefined;
  const returnUrl = typeof body?.returnUrl === "string" ? body.returnUrl : undefined;
  // Which profile is being upgraded — carried through so the webhook can set its tier.
  const profileId = typeof body?.profileId === "string" ? body.profileId : undefined;

  if (plan !== "pro" && plan !== "business") {
    return NextResponse.json({ error: "bad_request", message: "Unknown plan." }, { status: 400 });
  }
  if (!returnUrl) {
    return NextResponse.json({ error: "bad_request", message: "Missing returnUrl." }, { status: 400 });
  }

  const priceId = getStripePriceId(plan);
  if (!priceId) {
    return NextResponse.json(
      {
        error: "not_configured",
        message: `No Stripe price is configured for the "${plan}" plan yet — set STRIPE_PRICE_ID_${plan.toUpperCase()}.`,
      },
      { status: 503 }
    );
  }

  try {
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: customerEmail,
      success_url: `${returnUrl}?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${returnUrl}?billing=cancelled`,
      allow_promotion_codes: true,
      client_reference_id: profileId,
      metadata: profileId ? { profile_id: profileId } : undefined,
      // Stamp the subscription too, so renewal/cancel webhooks know the profile + tier.
      subscription_data: profileId
        ? { metadata: { profile_id: profileId, tier: tierForPlan(plan) } }
        : undefined,
    });

    if (!session.url) {
      return NextResponse.json({ error: "stripe_error", message: "Stripe didn't return a checkout URL." }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    return NextResponse.json(
      { error: "stripe_error", message: err instanceof Error ? err.message : "Couldn't start checkout." },
      { status: 500 }
    );
  }
}
