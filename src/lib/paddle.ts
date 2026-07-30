// Thin wrapper around Paddle.js (loaded globally via a <script> tag in
// index.html, not an npm package) so the rest of the app never touches
// `window.Paddle` directly. Paddle's client-side token is public by design
// (it can only initiate a checkout, never move money on its own), so it's
// safe to ship in the bundle via a VITE_ env var.

declare global {
  interface Window {
    Paddle?: {
      Environment: { set: (env: "sandbox" | "production") => void };
      Initialize: (opts: { token: string }) => void;
      Checkout: { open: (opts: Record<string, unknown>) => void };
    };
  }
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
 * Opens Paddle's hosted checkout overlay for the given price. `userId` is
 * passed through as custom data so the webhook can map the resulting
 * subscription back to a Supabase profile without needing Paddle to know
 * anything about our schema.
 */
export function openPaddleCheckout(priceId: string, userId: string, email?: string) {
  ensurePaddleInitialized();
  if (!window.Paddle) {
    console.error("Paddle.js failed to load — check network/ad-blocker.");
    return;
  }
  window.Paddle.Checkout.open({
    items: [{ priceId, quantity: 1 }],
    customer: email ? { email } : undefined,
    customData: { user_id: userId },
  });
}