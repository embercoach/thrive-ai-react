-- ============================================================
-- Thrive AI: enforce free-tier item limits server-side
-- ============================================================
-- Run this in the Supabase SQL Editor BEFORE applying the matching code
-- patch (fix/enforce-free-tier-limits-server-side) — though this migration
-- doesn't actually require any client code changes; see the note at the
-- bottom.
--
-- Goals, budgets, and recurring bills are each capped at 2 items for
-- non-Pro users, but that cap was only ever enforced in the React
-- components (AddGoalModal, ManageBudgetsModal, ManageRecurringModal)
-- before calling a plain insert/upsert. Row Level Security only checks
-- that a row belongs to the caller (auth.uid() = user_id) — it has no
-- concept of "and no more than N of these" — so any free user could open
-- devtools and call supabase.from('goals').insert(...) (or budgets /
-- recurring) directly with their own valid session and create unlimited
-- goals, budgets, and recurring bills for free. This is the exact same bug
-- class already fixed for is_pro and the AI question counter earlier this
-- session (lock_down_privileged_profile_columns.sql) — this closes the
-- remaining instance of it.
--
-- Safe to run more than once — every statement below is idempotent
-- (create-or-replace / drop-if-exists).
-- ============================================================

create or replace function public.enforce_item_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_pro boolean;
  v_limit constant integer := 2;
  v_count integer;
begin
  -- No server-side code path writes to these tables today, but exempting
  -- the service role keeps the door open for a future admin/backfill
  -- script without needing to touch this trigger.
  if auth.role() = 'service_role' then
    return new;
  end if;

  select is_pro into v_is_pro from public.profiles where id = new.user_id;
  if v_is_pro then
    return new;
  end if;

  if tg_table_name = 'budgets' then
    -- upsertBudget() always goes through INSERT ... ON CONFLICT (user_id,
    -- category) DO UPDATE, and Postgres fires the BEFORE INSERT trigger for
    -- every proposed row even when it will actually take the UPDATE path —
    -- so editing the amount on a budget category the user already has must
    -- be let through here, or a free user who already has 2 budgets could
    -- never edit either of them again.
    if exists (
      select 1 from public.budgets
      where user_id = new.user_id and category = new.category
    ) then
      return new;
    end if;
  end if;

  -- Serializes concurrent inserts for the same user + table so two
  -- simultaneous requests (two tabs, two devices) can't both read "1 of 2
  -- used" and both be allowed through, landing at 3 — the same race class
  -- closed for the AI question counter, applied here with a lightweight
  -- advisory lock instead of a row lock, since a brand-new row has nothing
  -- to lock onto yet. Released automatically at transaction end.
  perform pg_advisory_xact_lock(hashtext(new.user_id::text || tg_table_name)::bigint);

  execute format('select count(*) from public.%I where user_id = $1', tg_table_name)
    into v_count
    using new.user_id;

  if v_count >= v_limit then
    raise exception 'Free plan limit of % reached for %. Upgrade to Pro for unlimited access.', v_limit, tg_table_name
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_item_limit on public.goals;
create trigger enforce_item_limit
  before insert on public.goals
  for each row
  execute function public.enforce_item_limit();

drop trigger if exists enforce_item_limit on public.budgets;
create trigger enforce_item_limit
  before insert on public.budgets
  for each row
  execute function public.enforce_item_limit();

drop trigger if exists enforce_item_limit on public.recurring;
create trigger enforce_item_limit
  before insert on public.recurring
  for each row
  execute function public.enforce_item_limit();

-- No code patch is strictly required alongside this migration: every
-- caller (AddGoalModal.handleSave, ManageBudgetsModal.handleSaveRow /
-- handleAddNew, ManageRecurringModal.handleAdd) already checks the
-- returned `error` from its api.* call and renders `error.message`, so a
-- request that somehow reaches the database over the limit (bypassing the
-- client-side pre-check, which is the whole point of this migration) will
-- surface this trigger's message the same way any other save error does.
