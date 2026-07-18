// Shared domain types

export type Exercise = {
  id: string;
  user_id: string;
  name: string;
  current_weight: number;
  increment: number;
  deload_pct: number;
  sets: number;
  reps: number;
  bar_weight: number;
  fail_streak: number;
  deload_after_fails: number;
  sort_order: number;
  archived: boolean;
  created_at: string;
};

export type WorkoutTemplate = {
  id: string;
  user_id: string;
  name: string;
  sort_order: number;
};

export type TemplateExercise = {
  id: string;
  template_id: string;
  exercise_id: string;
  sort_order: number;
};

export type WorkoutSession = {
  id: string;
  user_id: string;
  template_id: string | null;
  template_name: string | null;
  performed_at: string; // YYYY-MM-DD
  body_weight: number | null;
  notes: string | null;
  duration_seconds: number | null;
  created_at: string;
};

export type SessionExercise = {
  id: string;
  session_id: string;
  exercise_id: string | null;
  exercise_name: string;
  weight: number;
  target_sets: number;
  target_reps: number;
  sort_order: number;
};

export type SessionSet = {
  id: string;
  session_exercise_id: string;
  set_number: number;
  reps: number;
  completed: boolean;
};

export type SleepEntry = {
  id: string;
  user_id: string;
  night_of: string; // YYYY-MM-DD
  bedtime: string | null;
  wake_time: string | null;
  duration_minutes: number | null;
  quality: number | null;
  notes: string | null;
  tags: string[];
  // Richer fields (feed the sleep score)
  latency_minutes: number | null;
  awakenings: number | null;
  awake_minutes: number | null;
  exercise: string | null; // rest|strength|cardio|both
  caffeine_pm: boolean | null;
  alcohol: boolean | null;
  stress: number | null; // 1..5
  room_temp: number | null;
  morning_energy: number | null; // 1..5
  morning_mood: number | null; // 1..5
  symptoms: string | null;
  nap_minutes: number | null;
  created_at: string;
};
