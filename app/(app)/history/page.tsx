import { createClient } from "@/lib/supabase/server";
import HistoryClient, { type SessionSummary } from "@/components/HistoryClient";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const supabase = await createClient();

  const { data: sessions } = await supabase
    .from("workout_sessions")
    .select(
      "id, performed_at, template_name, body_weight, notes, duration_seconds, session_exercises(exercise_name, weight, target_sets, target_reps)"
    )
    .order("performed_at", { ascending: false })
    .limit(200);

  const summaries: SessionSummary[] = (sessions ?? []).map((s: any) => ({
    id: s.id,
    performed_at: s.performed_at,
    template_name: s.template_name,
    body_weight: s.body_weight,
    notes: s.notes,
    duration_seconds: s.duration_seconds,
    exercises: (s.session_exercises ?? []).map((e: any) => ({
      name: e.exercise_name,
      weight: e.weight,
      sets: e.target_sets,
      reps: e.target_reps,
    })),
  }));

  return <HistoryClient sessions={summaries} />;
}
