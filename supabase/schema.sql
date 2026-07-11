-- ============================================================================
--  Health App — Supabase schema
--  Run this in the Supabase SQL Editor (Dashboard → SQL → New query → Run).
--  Safe to re-run: uses "if not exists" / "on conflict" throughout.
-- ============================================================================

-- ----------------------------------------------------------------------------
--  Extensions
-- ----------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
--  profiles  — one row per auth user
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  weight_unit    text not null default 'lb',
  seeded         boolean not null default false,
  sleep_factors  text[] not null default '{}',   -- the user's sleep factor chips
  created_at     timestamptz not null default now()
);

-- Upgrade path for databases created before `sleep_factors` existed.
alter table public.profiles
  add column if not exists sleep_factors text[] not null default '{}';

-- ----------------------------------------------------------------------------
--  exercises — the user's exercise catalog + live progression state
-- ----------------------------------------------------------------------------
create table if not exists public.exercises (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users (id) on delete cascade,
  name                  text not null,
  current_weight        numeric not null default 45,     -- working weight now
  increment             numeric not null default 5,      -- +weight after success
  deload_pct            numeric not null default 10,     -- % drop on deload
  sets                  integer not null default 5,
  reps                  integer not null default 5,
  bar_weight            numeric not null default 45,     -- for plate calculator
  fail_streak           integer not null default 0,      -- consecutive failed sessions
  deload_after_fails    integer not null default 3,      -- deload trigger
  sort_order            integer not null default 0,
  archived              boolean not null default false,
  created_at            timestamptz not null default now()
);
create index if not exists exercises_user_idx on public.exercises (user_id);

-- ----------------------------------------------------------------------------
--  workout_templates — e.g. "A" and "B"
-- ----------------------------------------------------------------------------
create table if not exists public.workout_templates (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists templates_user_idx on public.workout_templates (user_id);

create table if not exists public.template_exercises (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null references public.workout_templates (id) on delete cascade,
  exercise_id  uuid not null references public.exercises (id) on delete cascade,
  sort_order   integer not null default 0
);
create index if not exists template_exercises_tpl_idx on public.template_exercises (template_id);

-- ----------------------------------------------------------------------------
--  workout_sessions — one logged training day
-- ----------------------------------------------------------------------------
create table if not exists public.workout_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  template_id      uuid references public.workout_templates (id) on delete set null,
  template_name    text,                               -- snapshot ("A"/"B")
  performed_at     date not null default (now() at time zone 'utc')::date,
  body_weight      numeric,
  notes            text,
  duration_seconds integer,
  created_at       timestamptz not null default now()
);
create index if not exists sessions_user_date_idx
  on public.workout_sessions (user_id, performed_at desc);

-- ----------------------------------------------------------------------------
--  session_exercises — weight snapshot per exercise within a session
-- ----------------------------------------------------------------------------
create table if not exists public.session_exercises (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.workout_sessions (id) on delete cascade,
  exercise_id  uuid references public.exercises (id) on delete set null,
  exercise_name text not null,                          -- snapshot for history
  weight       numeric not null,
  target_sets  integer not null default 5,
  target_reps  integer not null default 5,
  sort_order   integer not null default 0
);
create index if not exists session_exercises_session_idx
  on public.session_exercises (session_id);

-- ----------------------------------------------------------------------------
--  session_sets — actual reps performed per set
-- ----------------------------------------------------------------------------
create table if not exists public.session_sets (
  id                   uuid primary key default gen_random_uuid(),
  session_exercise_id  uuid not null references public.session_exercises (id) on delete cascade,
  set_number           integer not null,
  reps                 integer not null default 0,
  completed            boolean not null default false
);
create index if not exists session_sets_se_idx
  on public.session_sets (session_exercise_id);

-- ----------------------------------------------------------------------------
--  sleep_entries
-- ----------------------------------------------------------------------------
create table if not exists public.sleep_entries (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  night_of         date not null,                       -- the date you went to bed
  bedtime          timestamptz,
  wake_time        timestamptz,
  duration_minutes integer,
  quality          integer,                             -- 1..5
  notes            text,
  tags             text[] not null default '{}',   -- factors, e.g. {"sleep tea"}
  created_at       timestamptz not null default now(),
  unique (user_id, night_of)
);
create index if not exists sleep_user_date_idx
  on public.sleep_entries (user_id, night_of desc);

-- Upgrade path for databases created before `tags` existed.
alter table public.sleep_entries
  add column if not exists tags text[] not null default '{}';

-- ============================================================================
--  Row Level Security — every table is locked to the owning auth user
-- ============================================================================
alter table public.profiles            enable row level security;
alter table public.exercises           enable row level security;
alter table public.workout_templates   enable row level security;
alter table public.template_exercises  enable row level security;
alter table public.workout_sessions    enable row level security;
alter table public.session_exercises   enable row level security;
alter table public.session_sets        enable row level security;
alter table public.sleep_entries       enable row level security;

-- profiles
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- exercises
drop policy if exists "own exercises" on public.exercises;
create policy "own exercises" on public.exercises
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- workout_templates
drop policy if exists "own templates" on public.workout_templates;
create policy "own templates" on public.workout_templates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- template_exercises (owned via parent template)
drop policy if exists "own template_exercises" on public.template_exercises;
create policy "own template_exercises" on public.template_exercises
  for all using (
    exists (
      select 1 from public.workout_templates t
      where t.id = template_exercises.template_id and t.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.workout_templates t
      where t.id = template_exercises.template_id and t.user_id = auth.uid()
    )
  );

-- workout_sessions
drop policy if exists "own sessions" on public.workout_sessions;
create policy "own sessions" on public.workout_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- session_exercises (owned via parent session)
drop policy if exists "own session_exercises" on public.session_exercises;
create policy "own session_exercises" on public.session_exercises
  for all using (
    exists (
      select 1 from public.workout_sessions s
      where s.id = session_exercises.session_id and s.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.workout_sessions s
      where s.id = session_exercises.session_id and s.user_id = auth.uid()
    )
  );

-- session_sets (owned via session_exercises → session)
drop policy if exists "own session_sets" on public.session_sets;
create policy "own session_sets" on public.session_sets
  for all using (
    exists (
      select 1
      from public.session_exercises se
      join public.workout_sessions s on s.id = se.session_id
      where se.id = session_sets.session_exercise_id and s.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1
      from public.session_exercises se
      join public.workout_sessions s on s.id = se.session_id
      where se.id = session_sets.session_exercise_id and s.user_id = auth.uid()
    )
  );

-- sleep_entries
drop policy if exists "own sleep" on public.sleep_entries;
create policy "own sleep" on public.sleep_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
--  Auto-create a profile row when a new auth user signs up
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
