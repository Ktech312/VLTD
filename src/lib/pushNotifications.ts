"use client";

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    Boolean(VAPID_PUBLIC_KEY)
  );
}

// Who a device's push subscription belongs to (found by testing, 2026-10-13):
//  * A subscription is saved against one account's profile, keyed by the device's endpoint. Signing out used to leave it in place,
//    so the previous account's message notifications (sender and text) kept arriving on the device, including while someone else
//    was signed in.
//  * The next account could not take the device over: the database lets an account change only its own rows, so its save was
//    refused, while the page still reported the device as "subscribed".
// Now: signing out removes the device's subscription (while still signed in, so the row can be deleted); another account taking over
// a device drops the old browser subscription so the old endpoint stops working; saving into a row that belongs to someone else
// starts a fresh subscription instead of failing; and "subscribed" is only reported when the account can see its own row.
// "Opted in" is remembered per account (parked with the rest of that account's device data) so the next sign-in on this device
// can turn notifications back on without asking the browser again.
const OPT_IN_KEY = "vltd_push_optin_v1";

function setOptIn(on: boolean) {
  try {
    if (on) window.localStorage.setItem(OPT_IN_KEY, "1");
    else window.localStorage.removeItem(OPT_IN_KEY);
  } catch {
    /* ignore */
  }
}

export type PushState = "unsupported" | "denied" | "subscribed" | "unsubscribed";

/** Best-effort check of the current subscription state for this device. */
export async function getPushSubscriptionState(): Promise<PushState> {
  if (!isPushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return "unsubscribed";
    // The browser may still hold a subscription that was saved by someone else who used this device: it only counts for the
    // signed-in account if the account can see its own saved row for it.
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      const { data, error } = await supabase.from("push_subscriptions").select("id").eq("endpoint", sub.endpoint).limit(1);
      if (!error && (!data || data.length === 0)) return "unsubscribed";
    }
    return "subscribed";
  } catch {
    return "unsubscribed";
  }
}

/** Registers the service worker, requests permission, subscribes, and
 *  saves the subscription against this profile. Returns false on any
 *  failure (permission denied, unsupported browser, save error) --
 *  callers should treat that as "stayed off," not throw. */
export async function subscribeToPush(profileId: string): Promise<boolean> {
  if (!isPushSupported() || !profileId) return false;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;

    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
    }

    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return false;

    const save = (endpoint: string, p256dh: string, auth: string) =>
      supabase.from("push_subscriptions").upsert(
        { profile_id: profileId, endpoint, p256dh, auth, updated_at: new Date().toISOString() },
        { onConflict: "endpoint" }
      );

    let { error } = await save(json.endpoint, json.keys.p256dh, json.keys.auth);
    if (error) {
      // This device's endpoint is saved against someone else's account (they never turned it off). Their row cannot be
      // overwritten, and must not keep receiving here: end the old browser subscription and start a fresh one for this account.
      await sub.unsubscribe();
      const fresh = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
      const next = fresh.toJSON();
      if (!next.endpoint || !next.keys?.p256dh || !next.keys?.auth) return false;
      ({ error } = await save(next.endpoint, next.keys.p256dh, next.keys.auth));
    }

    if (!error) setOptIn(true);
    return !error;
  } catch {
    return false;
  }
}

/** Unsubscribes this device and removes its saved subscription row. */
export async function unsubscribeFromPush(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return true;

    const endpoint = sub.endpoint;
    await sub.unsubscribe();

    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
    }
    setOptIn(false); // the person chose to turn it off
    return true;
  } catch {
    return false;
  }
}

/**
 * Sign-out: stop this device receiving the signed-out account's notifications. Must run while still signed in (the row can only be
 * deleted by its owner). Unlike an explicit "turn off", the account's opt-in is kept so its next sign-in here can restore it.
 */
export async function releasePushOnSignOut(): Promise<void> {
  if (!isPushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    const endpoint = sub.endpoint;
    const supabase = getSupabaseBrowserClient();
    if (supabase) await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
    await sub.unsubscribe();
  } catch {
    /* sign-out must never be blocked by this */
  }
}

/**
 * A different account has taken over this device: end the browser subscription so the previous account's saved endpoint stops
 * working (its row cannot be deleted from here, and is cleaned up the next time a notification to it is refused).
 */
export async function dropDevicePushSubscription(): Promise<void> {
  if (!isPushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    await sub?.unsubscribe();
  } catch {
    /* ignore */
  }
}

/** Sign-in: if this account turned notifications on for this device before and the browser still allows them, turn them back on quietly. */
export async function restorePushIfOptedIn(profileId: string): Promise<void> {
  if (!isPushSupported() || !profileId) return;
  try {
    if (window.localStorage.getItem(OPT_IN_KEY) !== "1") return;
    if (Notification.permission !== "granted") return;
    if ((await getPushSubscriptionState()) === "subscribed") return;
    await subscribeToPush(profileId);
  } catch {
    /* best effort */
  }
}
