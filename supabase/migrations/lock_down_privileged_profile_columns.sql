-- ============================================================
-- Thrive AI: lock down privileged profile columns
-- ============================================================
-- Run this in the Supabase SQL Editor BEFORE applying the matching code
-- patch (fix/lock-down-pro-and-ai-quota). It does two things:
--
-- 1. Adds a trigger so `is_pro`, `ai_questions_count`, and
--    `ai_questions_month` on `profiles` can only ever be changed by the
--    service-role key (used server-side in api/paddle-webhook.ts and
--    api/chat.ts) — never by a signed-in user's own session, however that
--    write is made (through the app, or by hand in the browser console).
--
--    Without this, Row Level Security being row-level (a standard
--    `auth.uid() = id` policy) has no column-level boundary: any write a
--    user is otherwise allowed to make to their OWN row — e.g. saving
--    their currency via the Profile page — has nothing stopping them from
--    also including `is_pro: true` in that same request and permanently
--    granting themselves Pro for free, bypassing Paddle and payment
--    entirely. This was confirmed exploitable: the app's own client code
--    already calls a generic `upsertProfile()` with a user's normal
--    session and no column allowlist.
--
-- 2. Adds an atomic, race-proof RPC (`use_ai_question`) that the AI chat
--    API route calls to check-and-increment the free-tier monthly
--    question counter in a single row-locked statement. This closes the
--    multi-tab/multi-device race on that counter that was identified (but
--    deliberately left unfixed, pending this migration) in an earlier
--    patch tonight, and replaces the client-side "read count, write
--    count + 1" upsert that the trigger above now blocks anyway.
--
-- Safe to run more than once — every statement below is idempotent
-- (create-or-replace / drop-if-exists).
-- ============================================================

create or replace function public.protect_privileged_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    if tg_op = 'INSERT' then
      -- `upsertProfile()` in the app calls .upsert(), which takes this
      -- INSERT path instead of UPDATE when the caller's row doesn't exist
      -- yet — there's no `old` row to fall back to here, so a brand-new
      -- row created by anyone other than the service role always starts
      -- at the safe defaults, never at whatever the client tried to set.
      new.is_pro := false;
      new.ai_questions_count := 0;
      new.ai_questions_month := null;
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
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_privileged_profile_columns on public.profiles;

create trigger protect_privileged_profile_columns
  before insert or update on public.profiles
  for each row
  execute function public.protect_privileged_profile_columns();

-- Atomically checks the free-tier monthly AI-question limit and, if the
-- user is under it, increments the counter in the SAME locked statement
-- (`for update` takes a row lock for the rest of the transaction), so two
-- concurrent requests from two tabs/devices can never both read "2 used"
-- and both write back "3" — one of them will wait for the other's
-- transaction to commit first and then see the up-to-date count.
--
-- `p_month` must be computed by the CALLER from its own trusted clock, not
-- from anything the browser sent — this function has no way to tell a real
-- date from a made-up one, so trusting a client-supplied month would let
-- anyone reset their own counter on demand just by lying about the date.
create or replace function public.use_ai_question(p_user_id uuid, p_month text, p_limit integer)
returns table(allowed boolean, new_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_pro boolean;
  v_month text;
  v_count integer;
begin
  select is_pro, ai_questions_month, ai_questions_count
    into v_is_pro, v_month, v_count
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    return query select false, 0;
    return;
  end if;

  if v_is_pro then
    return query select true, coalesce(v_count, 0);
    return;
  end if;

  if v_month is distinct from p_month then
    v_count := 0;
  end if;

  v_count := coalesce(v_count, 0);

  if v_count >= p_limit then
    return query select false, v_count;
    return;
  end if;

  v_count := v_count + 1;

  update public.profiles
  set ai_questions_month = p_month, ai_questions_count = v_count
  where id = p_user_id;

  return query select true, v_count;
end;
$$;

-- Only the service-role key may call this — it's what api/chat.ts uses,
-- and it deliberately bypasses the trigger above (auth.role() = 'service_role'
-- inside this same request), which is exactly the one legitimate path that
-- should be able to move the counter.
revoke all on function public.use_ai_question(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.use_ai_question(uuid, text, integer) to service_role;
