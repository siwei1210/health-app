-- ============================================================================
--  Migration: Deadlift default → 3 sets × 5 reps
--  Date: 2026-08-22
--  Run in the Supabase SQL Editor (Dashboard → SQL → New query → Run).
--  Safe to re-run: it only rewrites Deadlift rows that aren't already 3×5.
-- ----------------------------------------------------------------------------
--  Context: the seed default for new accounts is already 3×5 (in lib/seed.ts),
--  but the seed runs once per account and never rewrites existing rows. This
--  one-time update corrects Deadlift rows that were seeded before the change.
-- ============================================================================

update public.exercises
set sets = 3, reps = 5
where name = 'Deadlift'
  and (sets is distinct from 3 or reps is distinct from 5);
