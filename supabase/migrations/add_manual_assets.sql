-- ============================================================
-- Thrive AI: Net worth / manual assets
-- ============================================================
-- Run this in the Supabase SQL Editor BEFORE applying the matching code
-- patch (feature: net worth / manual assets).
--
-- public.manual_assets - one row per asset the user has told the app about
-- directly (an investment account, a property, a vehicle, cash held
-- outside any linked bank, etc.) rather than one synced from Plaid. Summed
-- alongside the existing transactions-only net worth figure (see
-- useNetWorth in src/hooks/useHomeMetrics.ts) so a user with real assets
-- beyond their linked bank balances sees an actual net worth, not just a
-- cash-flow total.
--
-- Ordinary per-user RLS (unlike plaid_items/plaid_accounts) - there's no
-- secret here comparable to a Plaid access_token, and every read/write goes
-- straight from the client the same way goals/budgets/recurring already do.
--
-- Safe to run more than once - every statement below is idempotent
-- (create-or-replace / if-not-exists / drop-if-exists).
-- ============================================================

create table if not exists public.manual_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text not null,
  value numeric not null,
  created_at timestamptz not null default now()
);

alter table public.manual_assets drop constraint if exists manual_assets_category_check;
alter table public.manual_assets add constraint manual_assets_category_check
  check (category in ('investment', 'property', 'vehicle', 'cash', 'other'));

alter table public.manual_assets enable row level security;

drop policy if exists "Users can view their own manual assets" on public.manual_assets;
create policy "Users can view their own manual assets" on public.manual_assets
  for select using (auth.uid() = user_id);

drop policy if exists "Users can insert their own manual assets" on public.manual_assets;
create policy "Users can insert their own manual assets" on public.manual_assets
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their own manual assets" on public.manual_assets;
create policy "Users can update their own manual assets" on public.manual_assets
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own manual assets" on public.manual_assets;
create policy "Users can delete their own manual assets" on public.manual_assets
  for delete using (auth.uid() = user_id);
