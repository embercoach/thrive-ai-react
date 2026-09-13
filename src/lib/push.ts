import { supabase } from "@/services/supabase";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** "unsupported" is distinct from every real NotificationPermission value so
 *  the UI can tell "this browser can't do push" apart from "it can, and
 *  here's the current permission" without a second support check. */
export function getPushPermission(): NotificationPermission | "unsupported" {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

// Web Push wants the VAPID public key as a raw Uint8Array, but it's only
// ever handed to us (and only ever practical to store in an env var) as the
// URL-safe base64 string the `web-push` library prints.
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  // Explicitly typed as ArrayBuffer (not the wider ArrayBufferLike a bare
  // `new Uint8Array(length)` infers) — pushManager.subscribe()'s
  // applicationServerKey wants BufferSource, which excludes SharedArrayBuffer.
  const buffer = new ArrayBuffer(rawData.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

export async function isPushSubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return false;
  const sub = await reg.pushManager.getSubscription();
  return !!sub;
}

/** Registers the service worker, asks for notification permission, creates
 *  a push subscription, and saves it against this user so the server-side
 *  reminder job can find it. Safe to call again on a device that's already
 *  subscribed — it reuses the existing subscription rather than creating a
 *  second one. */
export async function subscribeToPush(userId: string): Promise<{ error: string | null }> {
  if (!isPushSupported()) {
    return { error: "Push notifications aren't supported in this browser." };
  }
  if (!VAPID_PUBLIC_KEY) {
    return { error: "Push notifications aren't configured yet." };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return {
      error:
        permission === "denied"
          ? "Notifications are blocked for this site. Allow them in your browser's site settings, then try again."
          : "Permission wasn't granted.",
    };
  }

  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return { error: "Couldn't complete subscription. Please try again." };
    }

    const { error } = await supabase.from("push_subscriptions").upsert(
      { user_id: userId, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth },
      { onConflict: "user_id,endpoint" }
    );
    if (error) return { error: error.message };
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't enable push notifications." };
  }
}

/** Cancels the browser-level subscription and removes the matching row so
 *  the server stops trying to reach this device. */
export async function unsubscribeFromPush(userId: string): Promise<{ error: string | null }> {
  if (!isPushSupported()) return { error: null };

  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      const { error } = await supabase
        .from("push_subscriptions")
        .delete()
        .eq("user_id", userId)
        .eq("endpoint", endpoint);
      if (error) return { error: error.message };
    }
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't disable push notifications." };
  }
}
