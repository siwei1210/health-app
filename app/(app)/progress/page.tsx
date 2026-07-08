import { createClient } from "@/lib/supabase/server";
import ProgressClient, { type ExercisePoint } from "@/components/ProgressClient";
import { e1rm } from "@/lib/logic";

export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("session_exercises")
    .select(
      "exercise_name, weight, workout_sessions!inner(performed_at), session_sets(reps, completed)"
    )
    .order("exercise_name");

  // Flatten into per-exercise, per-day points.
  const byExercise: Record<string, ExercisePoint[]> = {};
  for (const se of (data as any[]) ?? []) {
    const date = se.workout_sessions?.performed_at;
    if (!date) continue;
    const reps: number[] = (se.session_sets ?? []).map((s: any) => s.reps ?? 0);
    const totalReps = reps.reduce((a, b) => a + b, 0);
    const bestReps = reps.length ? Math.max(...reps) : 0;
    const point: ExercisePoint = {
      date,
      weight: Number(se.weight),
      volume: Math.round(Number(se.weight) * totalReps),
      e1rm: e1rm(Number(se.weight), bestReps),
      reps: totalReps,
    };
    (byExercise[se.exercise_name] ??= []).push(point);
  }
  for (const name of Object.keys(byExercise)) {
    byExercise[name].sort((a, b) => (a.date < b.date ? -1 : 1));
  }

  return <ProgressClient data={byExercise} />;
}
