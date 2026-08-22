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
  ]);

  // Average of recent actual durations per template (last 5 each) — powers the
  // finish-time estimate.
  const durLists: Record<string, number[]> = {};
  for (const s of (recentSessions as any[]) ?? []) {
    if (s.duration_seconds == null) continue;
    (durLists[s.template_name ?? ""] ??= []).push(Number(s.duration_seconds));
  }
  const avgDurationByTemplate: Record<string, number> = {};
  for (const [name, list] of Object.entries(durLists)) {
    const recent = list.slice(0, 5);
    avgDurationByTemplate[name] = Math.round(
      recent.reduce((a, b) => a + b, 0) / recent.length
    );
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
    />
  );
}
