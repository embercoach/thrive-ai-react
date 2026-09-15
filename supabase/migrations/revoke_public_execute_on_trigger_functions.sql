-- ============================================================
-- Thrive AI: stop exposing internal trigger functions as public RPCs
-- ============================================================
-- Run this in the Supabase SQL Editor. No matching code patch — this is a
-- database-only hardening pass with no application-visible behavior change.
--
-- Supabase's Security Advisor flags four SECURITY DEFINER functions as
-- "Public Can Execute" / "Signed-In Users Can Execute":
--   - public.enforce_item_limit()
--   - public.enforce_plaid_item_limit()
--   - public.handle_new_user()
--   - public.protect_privileged_profile_columns()
--
-- All four are pure trigger functions (RETURNS TRIGGER) that exist only to
-- run BEFORE INSERT/UPDATE on their tables — nothing in the app calls them
-- directly, and Postgres actually refuses to run a RETURNS TRIGGER function
-- outside of trigger context ("trigger functions can only be called as
-- triggers"), so this was never a live exploit path. The warning is about
-- hygiene: Postgres grants EXECUTE on every new function to PUBLIC by
-- default, and Supabase's PostgREST layer turns any public-schema function
-- with EXECUTE granted to anon/authenticated into an exposed RPC endpoint
-- (e.g. POST /rest/v1/rpc/enforce_item_limit) — needless surface area for
-- something that would only ever hand back a confusing error if called.
--
-- Revoking EXECUTE does not stop the triggers themselves from firing:
-- trigger functions run as the function owner when Postgres fires the
-- trigger, independent of the invoking session's own EXECUTE privilege on
-- the function. This is the same pattern already used for
-- use_ai_question() in lock_down_privileged_profile_columns.sql, applied
-- here to the trigger functions that didn't get it originally.
--
-- Safe to run more than once — REVOKE on a grant that's already gone is a
-- no-op, not an error.
-- ============================================================

revoke execute on function public.enforce_item_limit() from public, anon, authenticated;
revoke execute on function public.enforce_plaid_item_limit() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.protect_privileged_profile_columns() from public, anon, authenticated;
