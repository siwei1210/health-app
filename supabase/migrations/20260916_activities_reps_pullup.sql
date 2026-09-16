-- ============================================================================
--  Migration: activities.reps column + Pull up activity type
--  Date: 2026-09-16
--  Run in the Supabase SQL Editor (Dashboard → SQL → New query → Run).
--  Safe to re-run: "add column if not exists" is idempotent.
-- ----------------------------------------------------------------------------
--  The "Other" activity type was replaced by "Pull up", which tracks sets and
--  reps per set. `sets` already exists (used by dead hang holds); this adds the
--  per-set rep count.
-- ============================================================================

alter table public.activities
  add column if not exists reps integer;
