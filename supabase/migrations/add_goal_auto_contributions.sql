-- ============================================================
-- Thrive AI: Goal auto-contributions
-- ============================================================
-- Run this in the Supabase SQL Editor BEFORE applying the matching code
-- patch (feature: goal auto-contributions).
--
-- Three new nullable columns on public.goals: a goal with
-- auto_contribute_amount set is on a recurring auto-save schedule, applied
-- by the new daily api/apply-goal-contributions.ts cron job — the same
-- shape as public.recurring's next_date-driven bills, just living directly
-- on the goal row instead of a separate table, since a goal has at most
-- one active schedule.
--
-- Safe to run more than once - every statement below is idempotent
-- (add column if not exists / create or replace).
-- ============================================================

alter table public.goals add column if not exists auto_contribute_amount numeric;
alter table public.goals add column if not exists auto_contribute_next_date date;
alter table public.goals add column if not exists auto_contribute_frequency text;
alter table public.goals drop constraint if exists goals_auto_contribute_frequency_check;
alter table public.goals add constraint goals_auto_contribute_frequency_check
  check (auto_contribute_frequency is null or auto_contribute_frequency in ('weekly', 'biweekly', 'monthly'));

-- Applies one due auto-contribution atomically: bumps `current` by the
-- scheduled amount and advances `auto_contribute_next_date` to the caller-
-- computed next occurrence, in a single UPDATE - the same atomicity
-- rationale as public.increment_goal_current (see its own migration), so a
-- cron run landing at the same moment as a manual contribution from the
-- app can never have one silently clobber the other.
--
-- p_expected_prev_date guards against double-applying the SAME occurrence:
-- api/apply-goal-contributions.ts selects every goal whose
-- auto_contribute_next_date is due, then calls this once per goal. If that
-- cron invocation runs twice concurrently (a Vercel retry after a timeout,
-- or the endpoint getting hit again while a run is still in flight - there
-- was previously no protection against this at all), both invocations
-- would select the same due goal before either UPDATE lands, and without
-- this check both would apply the contribution, silently crediting the
-- goal's `current` balance twice for one real occurrence. Requiring
-- auto_contribute_next_date to still equal the value that made the goal
-- "due" when it was selected means the second invocation's UPDATE matches
-- zero rows - it lands after the first already advanced the date - so it
-- becomes a no-op instead of a duplicate credit.
--
-- Deliberately NOT scoped by auth.uid() (unlike increment_goal_current) -
-- this is only ever called by api/apply-goal-contributions.ts using the
-- service-role key, which has already selected the exact due rows it's
-- allowed to touch; auth.uid() would just be null in that context and
-- reject every call. This function is intentionally not granted to the
-- `authenticated` role for that same reason - see the note by the grant
-- statement below.
-- Postgres treats a different parameter list as a different overload, not
-- a replacement - `create or replace function` below would otherwise leave
-- the old 3-arg version (p_goal_id, p_amount, p_next_date) sitting
-- alongside this new 4-arg one on any database that already ran this
-- migration before p_expected_prev_date was added, instead of actually
-- replacing it.
drop function if exists public.apply_goal_auto_contribution(uuid, numeric, date);

create or replace function public.apply_goal_auto_contribution(
  p_goal_id uuid,
  p_amount numeric,
  p_expected_prev_date date,
  p_next_date date
)
returns public.goals
language plpgsql
set search_path = public
as $$
declare
  v_goal public.goals;
begin
  update public.goals
  set current = current + p_amount,
      auto_contribute_next_date = p_next_date
  where id = p_goal_id
    and auto_contribute_next_date = p_expected_prev_date
  returning * into v_goal;

  -- A null id here means either the goal no longer exists, or (the far more
  -- common case) auto_contribute_next_date had already moved past
  -- p_expected_prev_date because another invocation applied this same
  -- occurrence first. Either way there's nothing left to apply, so this
  -- returns a null row rather than raising - the caller (service-role only)
  -- treats a null id as "already applied / not found", not as a failure.
  return v_goal;
end;
$$;

-- No grant to `authenticated`: this function skips the auth.uid() ownership
-- check that every client-facing RPC in this project relies on for safety,
-- so exposing it to signed-in users directly would let anyone silently
-- top up (or corrupt the schedule on) any goal by id, not just their own.
-- The service role used by the cron job already bypasses grants/RLS, so it
-- needs no explicit grant here.
