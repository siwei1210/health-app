# Health

A personal **5×5 workout** and **sleep** tracker — a StrongLifts-style web app
built with **Next.js**, **Supabase** (Postgres + Auth), and deployed on
**Vercel**. Data is stored durably in Postgres so years of history can be
queried and analyzed later.

## Features

**Workout tab (5×5)**
- Workout **A** (Squat / Bench / Barbell Row) and **B** (Squat / OHP / Deadlift),
  auto-alternating each session
- Tappable **set circles** — tap to log reps per set (tap again to reduce reps
  on a missed set)
- Per-exercise **working weight**, editable via a bottom-sheet with a live
  **plate calculator** (plates-per-side)
- **Auto-progression**: hit all sets → weight goes up by your increment next
  time; miss 3 sessions → automatic deload. Increment / deload % / sets×reps
  all editable per exercise.
- **Body weight**, **notes**, and a **rest timer** per session

**Sleep tab**
- Log bedtime, wake time, quality (1–5), notes; duration is computed
  automatically (handles past-midnight wake times)
- 7-day average and recent history

**History tab** — calendar of training days + a detailed session list

**Progress tab** — per-exercise charts over time (Weight / e1RM / Volume / Reps)
with 1M · 3M · 6M · 1Y · 2Y · ∞ ranges

Everything is behind **Supabase Auth** (magic-link email login) with
**row-level security**, so your data is private to you.

---

## Setup

### 1. Create a Supabase project
1. Go to [supabase.com](https://supabase.com) → **New project**.
2. Once it's ready, open **SQL Editor → New query**, paste the contents of
   [`supabase/schema.sql`](supabase/schema.sql), and **Run**. This creates all
   tables, row-level-security policies, and the new-user trigger.
3. Under **Authentication → Providers → Email**, make sure **Email** is enabled
   (magic links are on by default).
4. Grab your keys from **Project Settings → API**:
   - `Project URL`
   - `anon` `public` key

### 2. Run locally
```bash
cp .env.local.example .env.local   # then fill in the two values
npm install
npm run dev                        # http://localhost:3000
```

On first login the app seeds the standard 5×5 program (your screenshot values:
Squat 101lb / Bench 95lb / Row 95lb, Squat +2lb increment). Adjust any exercise
by tapping its weight.

### 3. Deploy to Vercel
1. Push this repo to GitHub (already done if you're reading this on the branch).
2. In [Vercel](https://vercel.com) → **Add New Project** → import the repo.
3. Add the two environment variables (**Settings → Environment Variables**):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy. Then in Supabase → **Authentication → URL Configuration**, add your
   Vercel URL (e.g. `https://your-app.vercel.app`) to **Site URL** and
   **Redirect URLs** so magic links redirect back correctly.

---

## Data model

| Table | Purpose |
|-------|---------|
| `profiles` | one row per user; unit + seed flag |
| `exercises` | exercise catalog + live progression state (current weight, increment, fail streak) |
| `workout_templates` / `template_exercises` | Workout A/B definitions |
| `workout_sessions` | one logged training day (date, body weight, notes, duration) |
| `session_exercises` | weight snapshot per exercise in a session |
| `session_sets` | reps performed per set (the raw data for analysis) |
| `sleep_entries` | one row per night (bedtime, wake, duration, quality) |

Because every set is stored as its own row with weight and date, you can run
arbitrary SQL / analysis over years of training — e.g. tonnage per week,
estimated 1RM trends, or squat progression vs. sleep quality.

## Tech
Next.js 14 (App Router) · TypeScript · Tailwind · Supabase (`@supabase/ssr`) ·
Recharts.
