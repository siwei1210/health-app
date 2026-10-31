-- ============================================================================
--  Migration: all lifts increment +2 lb (1 lb per side)
--  Date: 2026-10-31
--  Run in the Supabase SQL Editor (Dashboard → SQL → New query → Run).
--  Safe to re-run: only touches rows not already at 2.
-- ----------------------------------------------------------------------------
--  The seed default for new accounts is +2 for every lift, but seeding runs
--  once and never rewrites existing rows. This sets the per-exercise increment
--  to 2 for existing exercises so every progression step is +2 lb total.
-- ============================================================================

update public.exercises
set increment = 2
where increment is distinct from 2;
