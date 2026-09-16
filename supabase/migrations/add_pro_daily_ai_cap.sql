-- ============================================================
-- Thrive AI: soft daily cap on Pro AI usage
-- ============================================================
-- Run this in the Supabase SQL Editor BEFORE applying the matching code
-- patch. Builds on lock_down_privileged_profile_columns.sql's
-- use_ai_question() RPC and protect_privileged_profile_columns() trigger.
--
-- use_ai_question() previously let a Pro user through unconditionally, with
-- no counter at all (`if v_is_pro then return query select true, ...`).
-- api/chat.ts and api/scan-receipt.ts don't otherwise bound how many
-- messages a single request can contain or how often a session can call
-- them, so a Pro account — a real one being misused, or a compromised
-- session — could script rapid-fire requests against the app's own paid
-- Anthropic API key with no server-side brake at all.
--
-- This adds a generous daily ceiling for Pro users specifically (the free
-- tier already has its own monthly limit and is untouched here). The
-- number is deliberately high enough that no real person doing real
-- budgeting/advisor conversations should ever see it — it exists to bound
-- worst-case cost exposure, not to ration normal use. Adjust
-- PRO_DAILY_QUESTIONS in api/chat.ts and api/scan-receipt.ts (duplicated
-- there per this project's convention) if that number needs to change.
--
-- Safe to run more than once — every statement below is idempotent
-- (add column if not exists / create-or-replace / drop-if-exists).
-- ============================================================

alter table public.profiles add column if not exists ai_questions_day date;
alter table public.profiles add column if not exists ai_questions_day_count integer;

-- Extends the existing trigger to also protect the two new counter
-- columns, for the same reason is_pro/ai_questions_count/ai_questions_month
-- are protected: without this, a Pro user could reset their own daily
-- counter (or forge a lower one) through any client write to their own
-- profile row that RLS would otherwise allow, e.g. the Profile page's
-- generic upsertProfile() call.
create or replace function public.protect_privileged_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    if tg_op = 'INSERT' then
      new.is_pro := false;
      new.ai_questions_count := 0;
      new.ai_questions_month := null;
      new.ai_questions_day_count := 0;
      new.ai_questions_day := null;
    else
      if new.is_pro is distinct from old.is_pro then
        new.is_pro := old.is_pro;
      end if;
      if new.ai_questions_count is distinct from old.ai_questions_count then
        new.ai_questions_count := old.ai_questions_count;
      end if;
      if new.ai_questions_month is distinct from old.ai_questions_month then
        new.ai_questions_month := old.ai_questions_month;
      end if;
      if new.ai_questions_day_count is distinct from old.ai_questions_day_count then
        new.ai_questions_day_count := old.ai_questions_day_count;
      end if;
      if new.ai_questions_day is distinct from old.ai_questions_day then
        new.ai_questions_day := old.ai_questions_day;
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- Postgres treats a different parameter list as a different overload, not
-- a replacement — drop the 3-arg version first so a database that already
-- ran lock_down_privileged_profile_columns.sql ends up with only the new
-- 5-arg function, not both sitting side by side.
drop function if exists public.use_ai_question(uuid, text, integer);

-- Same atomic check-and-increment shape as before, now with a second,
-- independent counter for Pro's daily cap. Free-tier callers are
-- unaffected — they still hit their existing monthly limit first and never
-- reach the Pro branch at all. `reason` tells the caller which limit was
-- hit, since "you've used your free questions" is the wrong message to
-- show a Pro user who hit the daily cap instead.
create or replace function public.use_ai_question(
  p_user_id uuid,
  p_month text,
  p_limit integer,
  p_day text,
  p_day_limit integer
)
returns table(allowed boolean, new_count integer, reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_pro boolean;
  v_month text;
  v_count integer;
  v_day text;
  v_day_count integer;
begin
  select is_pro, ai_questions_month, ai_questions_count, ai_questions_day, ai_questions_day_count
    into v_is_pro, v_month, v_count, v_day, v_day_count
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    return query select false, 0, 'not_found'::text;
    return;
  end if;

  if v_is_pro then
    if v_day is distinct from p_day then
      v_day_count := 0;
    end if;
    v_day_count := coalesce(v_day_count, 0);

    if v_day_count >= p_day_limit then
      return query select false, v_day_count, 'pro_daily_limit'::text;
      return;
    end if;

    v_day_count := v_day_count + 1;

    update public.profiles
    set ai_questions_day = p_day, ai_questions_day_count = v_day_count
    where id = p_user_id;

    return query select true, v_day_count, null::text;
    return;
  end if;

  if v_month is distinct from p_month then
    v_count := 0;
  end if;

  v_count := coalesce(v_count, 0);

  if v_count >= p_limit then
    return query select false, v_count, 'free_monthly_limit'::text;
    return;
  end if;

  v_count := v_count + 1;

  update public.profiles
  set ai_questions_month = p_month, ai_questions_count = v_count
  where id = p_user_id;

  return query select true, v_count, null::text;
end;
$$;

revoke all on function public.use_ai_question(uuid, text, integer, text, integer) from public, anon, authenticated;
grant execute on function public.use_ai_question(uuid, text, integer, text, integer) to service_role;
