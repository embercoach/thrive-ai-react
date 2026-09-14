-- ============================================================
-- Thrive AI: atomic goal contributions
-- ============================================================
-- Run this in the Supabase SQL Editor BEFORE applying the matching code
-- patch (feature/security-audit-pass).
--
-- ContributeGoalModal used to write `current: goal.current + amt`, where
-- `goal.current` came from a client-side snapshot rather than a fresh read.
-- Two contributions to the same goal racing from two devices (or two
-- browser tabs) each computed the new total from that same stale snapshot,
-- so the second write silently overwrote the first instead of stacking on
-- top of it — the app would show two successful confirmations but only
-- bank one contribution. This function does the read-and-add as a single
-- atomic UPDATE instead, closing that race entirely.
--
-- SECURITY INVOKER (the default) — this runs as the calling user, so the
-- existing RLS policy on public.goals (already required for the plain
-- `.update()` this replaces to have worked at all) is what actually scopes
-- the write; auth.uid() inside the WHERE clause is a second, redundant
-- guard against ever touching another user's row, the same
-- belt-and-suspenders style already used throughout src/services/api.ts.
--
-- Safe to run more than once — create-or-replace is idempotent.
-- ============================================================

create or replace function public.increment_goal_current(p_goal_id uuid, p_amount numeric)
returns public.goals
language plpgsql
set search_path = public
as $$
declare
  v_goal public.goals;
begin
  update public.goals
  set current = current + p_amount
  where id = p_goal_id and user_id = auth.uid()
  returning * into v_goal;

  if v_goal.id is null then
    raise exception 'Goal not found' using errcode = 'P0002';
  end if;

  return v_goal;
end;
$$;

grant execute on function public.increment_goal_current(uuid, numeric) to authenticated;
