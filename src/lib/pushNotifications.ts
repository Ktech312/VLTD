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

export type PushState = "unsupported" | "denied" | "subscribed" | "unsubscribed";

/** Best-effort check of the current subscription state for this device. */
export async function getPushSubscriptionState(): Promise<PushState> {
  if (!isPushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    return sub ? "subscribed" : "unsubscribed";
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

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        profile_id: profileId,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" }
    );

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
    return true;
  } catch {
    return false;
  }
}
