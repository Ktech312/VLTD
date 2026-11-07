import { NextRequest, NextResponse } from "next/server";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe";
import { getServiceClient, getSignedInUserId } from "@/lib/serverAdmin";

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

  // Only a signed-in person can look a checkout up, and only one that was started for one of their own profiles.
  const svc = getServiceClient();
  const userId = svc ? await getSignedInUserId(req, svc) : null;
  if (!svc || !userId) {
    return NextResponse.json({ error: "not_signed_in", message: "Sign in to confirm your subscription." }, { status: 401 });
  }

  try {
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const sessionProfileId = String(session.metadata?.profile_id || session.client_reference_id || "");
    let owned = false;
    if (sessionProfileId) {
      const { data: mine } = await svc.from("profiles").select("id").eq("id", sessionProfileId).eq("user_id", userId).limit(1);
      owned = !!mine && mine.length > 0;
    }
    if (!owned) {
      return NextResponse.json({ error: "forbidden", message: "That checkout doesn't belong to your account." }, { status: 403 });
    }
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
