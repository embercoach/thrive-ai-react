-- ============================================================
-- Thrive AI: periodic spending digest preference
-- ============================================================
-- Run this in the Supabase SQL Editor BEFORE applying the matching code
-- patch (feature: periodic spending digest notification).
--
-- One new column on public.profiles: digest_frequency, defaulting to
-- 'off'. Read and written by api/send-spending-digest.ts (the new cron
-- job) and by NotificationsPage.tsx's own upsertProfile() call — an
-- ordinary, non-privileged column, unlike is_pro/ai_questions_count/
-- ai_questions_month (see lock_down_privileged_profile_columns.sql),
-- since a user choosing their own notification cadence has no abuse
-- potential the way self-granting Pro would.
--
-- Safe to run more than once - every statement below is idempotent
-- (add column if not exists / drop-if-exists).
-- ============================================================

alter table public.profiles add column if not exists digest_frequency text not null default 'off';
alter table public.profiles drop constraint if exists profiles_digest_frequency_check;
alter table public.profiles add constraint profiles_digest_frequency_check
  check (digest_frequency in ('off', 'weekly', 'monthly'));
