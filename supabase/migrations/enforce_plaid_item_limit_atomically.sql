-- ============================================================
-- Thrive AI: close the free-tier bank-connection race
-- ============================================================
-- Run this in the Supabase SQL Editor BEFORE applying the matching code
-- patch (feature/security-audit-pass).
--
-- api/plaid-exchange-public-token.ts enforces FREE_BANK_LIMIT (1 bank on
-- the free plan) by counting existing plaid_items rows and then, later,
-- inserting a new one — the exact same check-then-act shape already fixed
-- for goals/budgets/recurring in enforce_free_tier_item_limits.sql. Two
-- concurrent Plaid Link flows for the same free user (two tabs, or the
-- Link flow retried after a slow response) can both pass the count check
-- before either insert lands, connecting 2+ banks on the free plan. This
-- adds the same advisory-lock trigger pattern used there, applied to
-- plaid_items.
--
-- Unlike enforce_free_tier_item_limits.sql's trigger, this one does NOT
-- exempt the service role: plaid_items is only ever written by this one
-- server endpoint (using the service-role key), so exempting service_role
-- would exempt the exact caller this trigger exists to constrain.
--
-- Safe to run more than once — every statement below is idempotent
-- (create-or-replace / drop-if-exists).
-- ============================================================

create or replace function public.enforce_plaid_item_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_pro boolean;
  v_limit constant integer := 1;
  v_count integer;
begin
  select is_pro into v_is_pro from public.profiles where id = new.user_id;
  if v_is_pro then
    return new;
  end if;

  -- Serializes concurrent inserts for the same user so two overlapping
  -- exchange-public-token calls can't both read "0 banks connected" and
  -- both be allowed through. Released automatically at transaction end.
  perform pg_advisory_xact_lock(hashtext(new.user_id::text || 'plaid_items')::bigint);

  select count(*) into v_count from public.plaid_items where user_id = new.user_id;

  if v_count >= v_limit then
    raise exception 'Free plan includes % connected bank. Upgrade to Pro to connect more.', v_limit
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_plaid_item_limit on public.plaid_items;
create trigger enforce_plaid_item_limit
  before insert on public.plaid_items
  for each row
  execute function public.enforce_plaid_item_limit();

-- No code patch changes are strictly required for the trigger itself to
-- take effect, but the matching patch does add a friendlier catch around
-- the insert in api/plaid-exchange-public-token.ts so a request that
-- somehow reaches this trigger over the limit (the race this migration
-- closes) surfaces the same "Free plan includes 1 connected bank" message
-- as the pre-check above it, instead of a raw Postgres error, and rolls
-- back the Plaid Item this endpoint already created before the insert.
