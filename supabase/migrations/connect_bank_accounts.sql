-- ============================================================
-- Thrive AI: Connected Banks (Plaid)
-- ============================================================
-- Run this in the Supabase SQL Editor BEFORE applying the matching code
-- patch (feature/connected-banks).
--
-- Three pieces:
--   1. plaid_items - one row per linked bank connection ("Item" in Plaid's
--      terms). Holds the Plaid access_token, which is as sensitive as a
--      password to that person's bank data - so, same pattern as
--      notification_log, RLS is enabled with ZERO policies. That makes it
--      unreadable and unwritable from the client no matter what, even by
--      its own owner; every read and write goes through a Vercel function
--      using the service-role key, which bypasses RLS entirely and is the
--      only thing that ever sees an access_token.
--   2. plaid_accounts - one row per bank account under an Item (a checking
--      and a savings account at the same bank are two rows). Denormalizes
--      the institution name onto each row so the client can render the
--      whole Connected Banks page from ONE table it's actually allowed to
--      read, without ever touching plaid_items. RLS here DOES allow the
--      owning user to select their own rows - there's no secret in this
--      table (balances and account labels only) - but still no client
--      insert/update/delete, since only a real Plaid link should ever be
--      able to create one of these.
--   3. transactions gets three new columns so bank-synced transactions can
--      live in the exact same table as manual ones (every existing screen -
--      Home, Spending, budgets, the AI advisor - already sums transactions
--      generically by category, so nothing else needs to change to make
--      synced transactions show up everywhere manual ones do):
--        - source: 'manual' (default, all existing rows) or 'plaid'.
--        - plaid_transaction_id: Plaid's own id for this transaction, used
--          as the dedupe key so re-syncing never creates duplicates.
--        - plaid_account_id: which linked account it came from, so
--          disconnecting a bank can find its transactions again later if
--          needed (kept on delete set null - removing a bank should not
--          erase your past transaction history).
--
-- Safe to run more than once - every statement below is idempotent
-- (create-or-replace / if-not-exists / drop-if-exists).
-- ============================================================

create table if not exists public.plaid_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null unique,
  access_token text not null,
  cursor text,
  status text not null default 'active' check (status in ('active', 'error')),
  institution_id text,
  institution_name text,
  created_at timestamptz not null default now(),
  last_synced_at timestamptz
);
alter table public.plaid_items enable row level security;
-- Deliberately zero policies - see the note above. All access is via the
-- service-role key from Vercel functions, which bypasses RLS entirely.

create table if not exists public.plaid_accounts (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.plaid_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id text not null unique,
  institution_id text,
  institution_name text,
  name text not null,
  mask text,
  type text,
  subtype text,
  current_balance numeric,
  available_balance numeric,
  currency text,
  created_at timestamptz not null default now()
);
alter table public.plaid_accounts enable row level security;
create policy "Users can view their own connected accounts" on public.plaid_accounts
  for select using (auth.uid() = user_id);
-- No insert/update/delete policy for the authenticated role on purpose -
-- only the service role (via Plaid Link + the exchange/sync functions)
-- should ever be able to create or change one of these rows.

alter table public.transactions add column if not exists source text not null default 'manual';
alter table public.transactions drop constraint if exists transactions_source_check;
alter table public.transactions add constraint transactions_source_check check (source in ('manual', 'plaid'));
alter table public.transactions add column if not exists plaid_transaction_id text unique;
alter table public.transactions add column if not exists plaid_account_id uuid references public.plaid_accounts(id) on delete set null;
