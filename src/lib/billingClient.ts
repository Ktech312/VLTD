"use client";

const STRIPE_CUSTOMER_KEY = "vltd_stripe_customer_id_v1";

export function getStoredStripeCustomerId(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(STRIPE_CUSTOMER_KEY) || "";
  } catch {
    return "";
  }
}

export function setStoredStripeCustomerId(customerId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STRIPE_CUSTOMER_KEY, customerId);
  } catch {
    // ignore
  }
}
