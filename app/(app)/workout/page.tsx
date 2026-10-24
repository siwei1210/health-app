import { createClient } from "@/lib/supabase/server";
import WorkoutTabs from "@/components/WorkoutTabs";
import { type TemplateWithExercises } from "@/components/WorkoutClient";
import { seedProgram } from "@/lib/seed";
import type { Activity, Exercise } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function WorkoutPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Seed the program (first login only; guarded by profiles.seeded) BEFORE
  // reading it, so the seed and the read never race on the first render.
  try {
    await seedProgram(supabase, user.id);
  } catch {
    // Non-fatal: the empty state below covers a failed seed.
  }

  const [
    { data: templates },
    { data: tplEx },
    { data: lastSession },
    { data: acts },
    { data: recentSessions },
    { data: lastPerf },
  ] = await Promise.all([
    supabase.from("workout_templates").select("*").order("sort_order"),
    supabase
      .from("template_exercises")
      .select("*, exercises(*)")
      .order("sort_order"),
    supabase
      .from("workout_sessions")
      .select("template_name, performed_at")
      .order("performed_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("activities")
      .select("*")
      .order("performed_at", { ascending: false })
      .limit(50),
    supabase
      .from("workout_sessions")
      .select("template_name, duration_seconds")
      .not("duration_seconds", "is", null)
      .order("performed_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("session_exercises")
      .select(
        "exercise_id, weight, workout_sessions!inner(performed_at), session_sets(reps, set_number)"
      )
      .limit(120),
  ]);

  // Average of recent actual durations per template (last 5 each) — powers the
  // finish-time estimate. Skip implausibly long sessions (> 3h): those come
  // from a stopwatch left running (forgot to tap the last set / click Finish)
  // and would otherwise blow up the estimate.
  const MAX_PLAUSIBLE_SEC = 3 * 3600;
  const durLists: Record<string, number[]> = {};
  for (const s of (recentSessions as any[]) ?? []) {
    const d = Number(s.duration_seconds);
    if (s.duration_seconds == null || !(d > 0) || d > MAX_PLAUSIBLE_SEC) continue;
    (durLists[s.template_name ?? ""] ??= []).push(d);
  }
  const avgDurationByTemplate: Record<string, number> = {};
  for (const [name, list] of Object.entries(durLists)) {
    const recent = list.slice(0, 5);
    avgDurationByTemplate[name] = Math.round(
      recent.reduce((a, b) => a + b, 0) / recent.length
    );
  }

  // Last performed weight + reps per exercise, so the workout screen can show
  // "what you did last time" with the suggested weight incremented on top.
  const lastPerformed: Record<
    string,
    { weight: number; date: string; reps: number[] }
  > = {};
  const perfRows = [...(((lastPerf as any[]) ?? []))].sort((a, b) =>
    (a.workout_sessions?.performed_at ?? "") <
    (b.workout_sessions?.performed_at ?? "")
      ? 1
      : -1
  );
  for (const r of perfRows) {
    const id = r.exercise_id as string | null;
    if (!id || lastPerformed[id]) continue; // first = most recent
    const reps = ((r.session_sets as any[]) ?? [])
      .slice()
      .sort((x, y) => x.set_number - y.set_number)
      .map((s) => Number(s.reps));
    lastPerformed[id] = {
      weight: Number(r.weight),
      date: r.workout_sessions?.performed_at ?? "",
      reps,
    };
  }

  const built: TemplateWithExercises[] = (templates ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    exercises: (tplEx ?? [])
      .filter((te) => te.template_id === t.id)
      .map((te) => te.exercises as Exercise)
      .filter(Boolean),
  }));

  // Alternate A → B → A. Pick the template *after* the last one performed.
  let startIndex = 0;
  if (lastSession?.template_name && built.length > 0) {
    const lastIdx = built.findIndex((t) => t.name === lastSession.template_name);
    if (lastIdx >= 0) startIndex = (lastIdx + 1) % built.length;
  }

  return (
    <WorkoutTabs
      templates={built}
      startIndex={startIndex}
      unit="lb"
      initialActivities={(acts as Activity[]) ?? []}
      avgDurationByTemplate={avgDurationByTemplate}
      lastPerformed={lastPerformed}
    />
  );
}
