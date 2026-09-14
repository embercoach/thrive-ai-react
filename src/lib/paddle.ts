// Thin wrapper around Paddle.js (loaded globally via a <script> tag in
// index.html, not an npm package) so the rest of the app never touches
// `window.Paddle` directly. Paddle's client-side token is public by design
// (it can only initiate a checkout, never move money on its own), so it's
// safe to ship in the bundle via a VITE_ env var.

import { supabase } from "@/services/supabase";

declare global {
  interface Window {
    Paddle?: {
      Environment: { set: (env: "sandbox" | "production") => void };
      Initialize: (opts: { token: string }) => void;
      Checkout: { open: (opts: Record<string, unknown>) => void };
      PricePreview: (opts: {
        items: { priceId: string; quantity: number }[];
      }) => Promise<PaddlePricePreviewResponse>;
    };
  }
}

interface PaddlePricePreviewResponse {
  data?: {
    details?: {
      lineItems?: {
        price?: { id?: string };
        formattedTotals?: { total?: string };
      }[];
    };
  };
}

/** Shape of the object Paddle's `eventCallback` invokes with — we only rely on `name`. */
export interface PaddleCheckoutEvent {
  name?: string;
  [key: string]: unknown;
}

let initialized = false;

function ensurePaddleInitialized() {
  if (initialized) return;
  const token = import.meta.env.VITE_PADDLE_CLIENT_TOKEN;
  if (!window.Paddle || !token) return;
  const live = import.meta.env.VITE_PADDLE_LIVE_MODE === "true";
  window.Paddle.Environment.set(live ? "production" : "sandbox");
  window.Paddle.Initialize({ token });
  initialized = true;
}

export function isPaddleConfigured(): boolean {
  return Boolean(import.meta.env.VITE_PADDLE_CLIENT_TOKEN);
}

/**
 * Fetches a short-lived, server-signed token binding this checkout to the
 * currently-authenticated Supabase user — see api/paddle-create-checkout-
 * token.ts. This is what the webhook trusts to decide whose profile to
 * update, instead of a raw client-supplied user id: `window.Paddle` is a
 * public, client-initialized script, so anyone could otherwise open
 * devtools and call `window.Paddle.Checkout.open()` directly with an
 * arbitrary `customData.user_id` and have a real (even minimal) purchase
 * flip `is_pro` on an account they don't control.
 */
async function fetchCheckoutToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;
  try {
    const res = await fetch("/api/paddle-create-checkout-token", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.token === "string" ? data.token : null;
  } catch {
    return null;
  }
}

/**
 * Opens Paddle's hosted checkout overlay for the given price. A signed
 * checkout token (see fetchCheckoutToken above) is passed through as
 * custom data so the webhook can map the resulting subscription back to a
 * Supabase profile it has actually verified, not merely one the client
 * claimed.
 *
 * `onEvent`, when given, is wired up as Paddle's `eventCallback` so the
 * caller can react to `checkout.completed` (e.g. to refetch the profile —
 * the webhook that actually flips `is_pro` in Supabase runs server-side and
 * has no other way to reach already-mounted React state).
 */
export async function openPaddleCheckout(
  priceId: string,
  email?: string,
  onEvent?: (event: PaddleCheckoutEvent) => void,
) {
  ensurePaddleInitialized();
  if (!window.Paddle) {
    console.error("Paddle.js failed to load — check network/ad-blocker.");
    return;
  }
  const token = await fetchCheckoutToken();
  if (!token) {
    console.error("Couldn't get a checkout token — is the user signed in?");
    return;
  }
  window.Paddle.Checkout.open({
    items: [{ priceId, quantity: 1 }],
    customer: email ? { email } : undefined,
    customData: { checkout_token: token },
    eventCallback: onEvent,
  });
}

/**
 * Asks Paddle what these prices actually cost, in the viewer's own currency.
 *
 * The upgrade modal used to show no price at all — people were asked to click
 * a payment button with no idea of the amount. Reading it from Paddle rather
 * than hardcoding it means the figure can never drift out of sync with what
 * the checkout will actually charge, and it localises for free.
 *
 * Returns a priceId -> formatted string map ("$4.99"), or an empty map if
 * anything goes wrong — callers must render fine without prices, since a
 * missing price is far better than a wrong one next to a Pay button.
 */
export async function fetchPriceLabels(priceIds: string[]): Promise<Record<string, string>> {
  const ids = priceIds.filter(Boolean);
  if (!ids.length) return {};
  ensurePaddleInitialized();
  if (!window.Paddle?.PricePreview) return {};

  try {
    const res = await window.Paddle.PricePreview({
      items: ids.map((priceId) => ({ priceId, quantity: 1 })),
    });
    const out: Record<string, string> = {};
    for (const item of res?.data?.details?.lineItems ?? []) {
      const id = item?.price?.id;
      const total = item?.formattedTotals?.total;
      if (id && total) out[id] = total;
    }
    return out;
  } catch (err) {
    console.error("Paddle PricePreview failed — showing the modal without prices.", err);
    return {};
  }
}
