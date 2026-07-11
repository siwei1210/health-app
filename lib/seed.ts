// First-login seeding of the StrongLifts 5x5 program.
// Defaults reflect the user's screenshots (Squat +2lb increment, working
// weights Squat 101 / Bench 95 / Row 95). Everything is editable later.

import type { SupabaseClient } from "@supabase/supabase-js";

type SeedExercise = {
  name: string;
  current_weight: number;
  increment: number;
  sets: number;
  reps: number;
};

// Exercise catalog. Default is 3 sets × 8 reps per exercise; sets/reps are
// editable per exercise in the app, so this is only the starting point.
const SQUAT: SeedExercise = { name: "Squat", current_weight: 101, increment: 2, sets: 3, reps: 8 };
const BENCH: SeedExercise = { name: "Bench Press", current_weight: 95, increment: 5, sets: 3, reps: 8 };
const ROW: SeedExercise = { name: "Barbell Row", current_weight: 95, increment: 5, sets: 3, reps: 8 };
const OHP: SeedExercise = { name: "Overhead Press", current_weight: 45, increment: 5, sets: 3, reps: 8 };
const DEAD: SeedExercise = { name: "Deadlift", current_weight: 95, increment: 10, sets: 3, reps: 8 };

// Workout A: Squat, Bench, Row   |   Workout B: Squat, OHP, Deadlift
const WORKOUT_A = [SQUAT, BENCH, ROW];
const WORKOUT_B = [SQUAT, OHP, DEAD];

export async function seedProgram(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  // Guard: only seed once.
  const { data: profile } = await supabase
    .from("profiles")
    .select("seeded")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) {
    await supabase.from("profiles").insert({ id: userId, seeded: false });
  }
  if (profile?.seeded) return;

  // Insert the exercise catalog (dedup by name).
  const catalog = [SQUAT, BENCH, ROW, OHP, DEAD];
  const exRows = catalog.map((e, i) => ({
    user_id: userId,
    name: e.name,
    current_weight: e.current_weight,
    increment: e.increment,
    sets: e.sets,
    reps: e.reps,
    sort_order: i,
  }));

  const { data: exercises, error: exErr } = await supabase
    .from("exercises")
    .insert(exRows)
    .select();
  if (exErr || !exercises) throw exErr ?? new Error("seed: exercises failed");

  const byName = new Map(exercises.map((e) => [e.name, e.id as string]));

  // Templates A & B
  const { data: templates, error: tErr } = await supabase
    .from("workout_templates")
    .insert([
      { user_id: userId, name: "A", sort_order: 0 },
      { user_id: userId, name: "B", sort_order: 1 },
    ])
    .select();
  if (tErr || !templates) throw tErr ?? new Error("seed: templates failed");

  const tplA = templates.find((t) => t.name === "A")!.id as string;
  const tplB = templates.find((t) => t.name === "B")!.id as string;

  const tplExRows = [
    ...WORKOUT_A.map((e, i) => ({
      template_id: tplA,
      exercise_id: byName.get(e.name)!,
      sort_order: i,
    })),
    ...WORKOUT_B.map((e, i) => ({
      template_id: tplB,
      exercise_id: byName.get(e.name)!,
      sort_order: i,
    })),
  ];
  const { error: teErr } = await supabase
    .from("template_exercises")
    .insert(tplExRows);
  if (teErr) throw teErr;

  await supabase.from("profiles").update({ seeded: true }).eq("id", userId);
}
