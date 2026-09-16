-- ============================================================
-- Thrive AI: AI Advisor reply feedback (thumbs up/down)
-- ============================================================
-- Run this in the Supabase SQL Editor BEFORE applying the matching code
-- patch. The thumbs up/down buttons on AssistantBubble previously only
-- toggled local component state — nothing was ever recorded, so the
-- control looked functional but silently did nothing.
--
-- Deliberately NOT a foreign key to chat_messages: a chat_messages row only
-- gets its real database id back after the insert in useChat.ts's send()
-- completes, well after the message is already rendered and back in the
-- user's hands, so tying feedback to that id would mean either racing that
-- save or leaving early taps in a session unrecordable. Storing the
-- message's own text alongside the rating avoids that race entirely and is
-- enough for the only real use of this data (reading through what got a
-- thumbs-down to see if the AI Advisor is giving bad answers) — it isn't
-- used to join back against chat_messages anywhere in the app.
--
-- Ordinary per-user RLS, same shape as public.feedback (Help & Feedback
-- page) and public.manual_assets — insert-only from the client's own
-- session; no update/delete policy, since a rating shouldn't be editable
-- after the fact any more than the Help & Feedback form's messages are.
--
-- Safe to run more than once - every statement below is idempotent
-- (create-or-replace / if-not-exists / drop-if-exists).
-- ============================================================

create table if not exists public.chat_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  message_text text not null,
  rating text not null,
  created_at timestamptz not null default now()
);

alter table public.chat_feedback drop constraint if exists chat_feedback_rating_check;
alter table public.chat_feedback add constraint chat_feedback_rating_check
  check (rating in ('up', 'down'));

alter table public.chat_feedback enable row level security;

-- Insert-only: the client submits a rating and never needs to read it back
-- (the buttons already reflect the tap locally via component state), so
-- there's no select/update/delete policy for the `authenticated` role.
drop policy if exists "Users can submit their own chat feedback" on public.chat_feedback;
create policy "Users can submit their own chat feedback" on public.chat_feedback
  for insert with check (auth.uid() = user_id);
