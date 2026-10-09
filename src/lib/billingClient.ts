"use client";

const STRIPE_CUSTOMER_KEY = "vltd_stripe_customer_id_v1";

// One billing customer per profile: personal and Business never share one.
function keyFor(profileId?: string) {
  return profileId ? `${STRIPE_CUSTOMER_KEY}:${profileId}` : STRIPE_CUSTOMER_KEY;
}

export function getStoredStripeCustomerId(profileId?: string): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(keyFor(profileId)) || "";
  } catch {
    return "";
  }
}

export function setStoredStripeCustomerId(customerId: string, profileId?: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(keyFor(profileId), customerId);
  } catch {
    // ignore
  }
}
