-- ============================================================
-- Thrive AI: verified Paddle subscription -> user mapping
-- ============================================================
-- Run this in the Supabase SQL Editor BEFORE applying the matching code
-- patch (feature/security-audit-pass).
--
-- api/paddle-webhook.ts used to trust `data.custom_data.user_id` directly
-- out of the webhook payload to decide whose profile.is_pro to flip. The
-- webhook's HMAC signature only proves Paddle sent the event — it says
-- nothing about whether custom_data.user_id is truthful, and that field
-- comes from `window.Paddle.Checkout.open({ customData: {...} })`, called
-- entirely client-side with a public token. Anyone could open devtools and
-- call it directly with an arbitrary user_id, so any real (even minimal)
-- purchase could flip is_pro on an account the payer doesn't control.
--
-- The matching code patch has the client fetch a short-lived, server-signed
-- token (proving who's actually authenticated) instead of sending a raw
-- user_id, and the webhook verifies that signature once, the first time it
-- sees a given subscription_id (on subscription.created/activated) —
-- storing the verified mapping here. Every later event for that same
-- subscription (renewals, cancellations, months down the line, long after
-- that first token has expired) looks the verified user_id up from this
-- table instead of re-trusting custom_data at all.
--
-- Written and read ONLY by the webhook's service-role key — there is no
-- client-facing reason to expose this table, so RLS is enabled with zero
-- policies, denying every request from an ordinary signed-in user.
-- ============================================================

create table if not exists public.paddle_subscriptions (
  subscription_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.paddle_subscriptions enable row level security;
-- Deliberately no policies — every client request is denied by default.
