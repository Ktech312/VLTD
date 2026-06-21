import { NextRequest, NextResponse } from "next/server";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe";

/**
 * Single shared entry point for both "Update card" and "Cancel plan" -
 * Stripe's hosted Billing Portal handles both in one place, so there's no
 * need for separate bespoke screens. Requires a Stripe customer id, which
 * only exists once a checkout has actually completed (see /api/billing/session).
 */
export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "not_configured", message: "Stripe isn't connected yet — add STRIPE_SECRET_KEY to enable billing." },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const customerId = typeof body?.customerId === "string" ? body.customerId : undefined;
  const returnUrl = typeof body?.returnUrl === "string" ? body.returnUrl : undefined;

  if (!customerId) {
    return NextResponse.json(
      { error: "no_customer", message: "No billing account on file yet — upgrade a plan first." },
      { status: 400 }
    );
  }
  if (!returnUrl) {
    return NextResponse.json({ error: "bad_request", message: "Missing returnUrl." }, { status: 400 });
  }

  try {
    const stripe = getStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    return NextResponse.json(
      { error: "stripe_error", message: err instanceof Error ? err.message : "Couldn't open the billing portal." },
      { status: 500 }
    );
  }
}
