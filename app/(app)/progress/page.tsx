import { createClient } from "@/lib/supabase/server";
import ProgressClient, {
  type ExercisePoint,
  type ActivityPoint,
} from "@/components/ProgressClient";
import { e1rm } from "@/lib/logic";
import { activityType } from "@/lib/activities";

export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const supabase = await createClient();

  const [{ data }, { data: acts }] = await Promise.all([
    supabase
      .from("session_exercises")
      .select(
        "exercise_name, weight, workout_sessions!inner(performed_at), session_sets(reps, completed)"
      )
      .order("exercise_name"),
    supabase.from("activities").select("*").order("performed_at"),
  ]);

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

  // Activities → per-type points (minutes for cardio, seconds for holds).
  const byActivity: Record<string, ActivityPoint[]> = {};
  for (const a of (acts as any[]) ?? []) {
    if (a.duration_seconds == null) continue;
    const def = activityType(a.type);
    const value =
      def.metric === "hold"
        ? Number(a.duration_seconds)
        : Math.round(Number(a.duration_seconds) / 60);
    (byActivity[a.type] ??= []).push({ date: a.performed_at, value });
  }
  for (const t of Object.keys(byActivity)) {
    byActivity[t].sort((a, b) => (a.date < b.date ? -1 : 1));
  }

  return <ProgressClient data={byExercise} activityData={byActivity} />;
}
