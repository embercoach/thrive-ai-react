-- ============================================================
-- Thrive AI: push notification infrastructure
-- ============================================================
-- Run this in the Supabase SQL Editor BEFORE applying the matching code
-- patch (feature/push-notifications).
--
-- Two new tables, both written only via the app's own service-role key
-- (never directly by client code with one exception noted below), so
-- neither needs the schema changes or triggers the earlier migrations in
-- this file used to lock down privileged columns on an existing table.
--
-- push_subscriptions: one row per browser/device a user has enabled push
-- notifications on (the Web Push API's subscription — an endpoint URL plus
-- the two keys needed to encrypt a payload to it). The client inserts its
-- own rows directly (via the anon key, scoped by RLS below) when the user
-- turns notifications on; only the server-side cron job ever reads or
-- deletes across users.
--
-- notification_log: a dedupe ledger so the daily reminder check never sends
-- the same "bill due" or "over budget" push twice for the same occurrence.
-- Written and read ONLY by the server (service-role key bypasses RLS
-- entirely) — there's no client-facing reason to expose this table at all,
-- so RLS is enabled with zero policies, which denies every request from an
-- ordinary signed-in user by default.
-- ============================================================

-- Supabase enables this by default on every project, but the migration
-- shouldn't depend on that silently — gen_random_uuid() below needs it.
create extension if not exists pgcrypto;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

create policy "Users can view their own push subscriptions"
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

create policy "Users can add their own push subscriptions"
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);

create policy "Users can remove their own push subscriptions"
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);

create table if not exists public.notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- 'bill_due' | 'budget_over'
  kind text not null,
  -- e.g. "<recurring_id>:<next_date>" or "<category>:<YYYY-MM>" — whatever
  -- makes one specific occurrence of that kind unique per user.
  dedupe_key text not null,
  sent_at timestamptz not null default now(),
  unique (user_id, kind, dedupe_key)
);

alter table public.notification_log enable row level security;
-- Deliberately no policies — every client request is denied by default;
-- only the service-role key (used exclusively by api/send-bill-reminders.ts)
-- ever touches this table.
