-- ============================================================
-- Thrive AI: missing UPDATE policy on push_subscriptions
-- ============================================================
-- Run this in the Supabase SQL Editor BEFORE applying the matching code
-- patch (feature/security-audit-pass) — though no code change is actually
-- required alongside this one; see the note at the bottom.
--
-- add_push_notifications.sql gave public.push_subscriptions select/insert/
-- delete RLS policies, but no update policy. src/lib/push.ts's
-- subscribeToPush() relies on an upsert with
-- onConflict: "user_id,endpoint" — when a browser re-subscribes with keys
-- that already have a row (e.g. the same device toggling notifications off
-- and back on, or the push service having rotated the subscription's keys
-- server-side), Postgres needs to take the UPDATE path of that upsert, and
-- RLS silently denies it with no update policy in place. The row is left
-- with stale p256dh/auth keys, so every future push to that device fails
-- to encrypt correctly and is silently dropped.
--
-- Safe to run more than once — create-or-replace-equivalent via
-- drop-if-exists.
-- ============================================================

drop policy if exists "Users can update their own push subscriptions" on public.push_subscriptions;
create policy "Users can update their own push subscriptions"
  on public.push_subscriptions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- No code patch changes are required for this fix — subscribeToPush()'s
-- existing upsert call already takes the UPDATE path correctly the moment
-- RLS actually permits it.
