-- ============================================================
-- Thrive AI: de-dupe chat_feedback ratings per (user, message)
-- ============================================================
-- Run this in the Supabase SQL Editor. Builds on add_chat_feedback.sql.
--
-- The original table was insert-only with no uniqueness constraint, so
-- re-rating the same AI Advisor reply — tapping thumbs-up, then
-- thumbs-down, then thumbs-up again, or simply navigating away from /ai
-- and back (which remounts the bubble and resets its local "already
-- rated" state) — silently piled up multiple, sometimes contradictory,
-- rows for the exact same message instead of updating one. That defeats
-- the table's only real purpose: reading through what got a thumbs-down
-- to see if the AI Advisor is giving bad answers.
--
-- The full message_text can't be used directly as a unique key — Postgres
-- btree index entries cap out around 2704 bytes, and a long AI Advisor
-- reply can exceed that — so this adds a generated md5 hash column and
-- constrains on (user_id, message_hash) instead. The matching code change
-- (src/services/api.ts's submitChatFeedback) switches from insert() to
-- upsert() against this constraint, so re-rating updates the existing row
-- in place.
--
-- Safe to run more than once — every statement below is idempotent.
-- ============================================================

-- Collapse any duplicates that already exist (e.g. from testing before
-- this migration ran), keeping only the most recent rating per
-- user+message. A no-op if there are none yet.
delete from public.chat_feedback a
using public.chat_feedback b
where a.user_id = b.user_id
  and md5(a.message_text) = md5(b.message_text)
  and (a.created_at, a.id) < (b.created_at, b.id);

alter table public.chat_feedback
  add column if not exists message_hash text generated always as (md5(message_text)) stored;

drop index if exists chat_feedback_user_message_hash_idx;
create unique index chat_feedback_user_message_hash_idx
  on public.chat_feedback (user_id, message_hash);
