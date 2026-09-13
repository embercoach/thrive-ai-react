-- Adds a per-user language preference so a signed-in user's chosen app
-- language follows them to another device, the same way `currency` does.
--
-- Left nullable with no default: when it's null, the app falls back to
-- device-local detection (localStorage, then browser language, then
-- English) exactly as it already does for a brand new/signed-out visitor.
-- It only starts overriding that once a signed-in user actually picks a
-- language in Profile > Language.
--
-- This column is NOT covered by the protect_privileged_profile_columns
-- trigger (that trigger only guards is_pro, ai_questions_count,
-- ai_questions_month), so it can be freely self-set by the user via the
-- existing upsertProfile() RLS policy — same as currency and name.
alter table public.profiles
  add column if not exists language text;
