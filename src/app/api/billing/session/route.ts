import { NextRequest, NextResponse } from "next/server";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe";

/**
 * Called once on return from Stripe Checkout (?session_id=...) to capture
 * the resulting Stripe customer id. We don't have a billing table, so the
 * client stores this id in localStorage (same pattern as the rest of the
 * app's local-first state) and sends it back on future portal requests.
 */
export async function GET(req: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const sessionId = req.nextUrl.searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json({ error: "bad_request", message: "Missing session_id." }, { status: 400 });
  }

  try {
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;

    if (!customerId || session.payment_status === "unpaid") {
      return NextResponse.json({ error: "incomplete", message: "Checkout wasn't completed." }, { status: 400 });
    }

    return NextResponse.json({ customerId, status: session.status });
  } catch (err) {
    return NextResponse.json(
      { error: "stripe_error", message: err instanceof Error ? err.message : "Couldn't confirm checkout." },
      { status: 500 }
    );
  }
}
