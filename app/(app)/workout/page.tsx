import { createClient } from "@/lib/supabase/server";
import WorkoutClient, { type TemplateWithExercises } from "@/components/WorkoutClient";
import type { Exercise } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function WorkoutPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: templates }, { data: tplEx }, { data: lastSession }] =
    await Promise.all([
      supabase
        .from("workout_templates")
        .select("*")
        .order("sort_order"),
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
    ]);

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
    <WorkoutClient
      templates={built}
      startIndex={startIndex}
      unit="lb"
    />
  );
}
