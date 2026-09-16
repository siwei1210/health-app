// Activity types for the general training log. `metric` decides which input
// the logger shows: "duration" = minutes (cardio/recovery), "hold" = seconds
// with optional sets (e.g. dead hang), "reps" = sets × reps (e.g. pull ups).
export type ActivityMetric = "duration" | "hold" | "reps";

export type ActivityTypeDef = {
  key: string;
  label: string;
  emoji: string;
  metric: ActivityMetric;
  color: string; // accent used in History / charts
};

// Strength (5x5) accent, used alongside the activity colors.
export const STRENGTH_COLOR = "#ff3b30"; // red

export const ACTIVITY_TYPES: ActivityTypeDef[] = [
  { key: "row", label: "Row", emoji: "🚣", metric: "duration", color: "#ff9500" }, // orange
  { key: "walk", label: "Walk / Recovery", emoji: "🚶", metric: "duration", color: "#34c759" }, // green
  { key: "dead_hang", label: "Dead hang", emoji: "🧗", metric: "hold", color: "#0a84ff" }, // blue
  { key: "stretch", label: "Stretch / Mobility", emoji: "🧘", metric: "duration", color: "#5ac8fa" }, // teal
  { key: "cardio", label: "Cardio", emoji: "🚴", metric: "duration", color: "#af52de" }, // purple
  { key: "pull_up", label: "Pull up", emoji: "💪", metric: "reps", color: "#5856d6" }, // indigo
];

export function activityType(key: string): ActivityTypeDef {
  return (
    ACTIVITY_TYPES.find((t) => t.key === key) ?? {
      key,
      label: key,
      emoji: "•",
      metric: "duration",
      color: "#8e8e93",
    }
  );
}

// Human-readable primary metric, e.g. "10 min", "3×30s", or "3×10".
export function formatActivityMetric(a: {
  type: string;
  duration_seconds: number | null;
  sets: number | null;
  reps?: number | null;
}): string {
  const t = activityType(a.type);
  if (t.metric === "reps") {
    if (a.sets != null && a.reps != null) return `${a.sets}×${a.reps}`;
    if (a.reps != null) return `${a.reps} reps`;
    if (a.sets != null) return `${a.sets} sets`;
    return "";
  }
  if (a.duration_seconds == null) return "";
  if (t.metric === "hold") {
    const s = a.duration_seconds;
    const base = s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
    return a.sets ? `${a.sets}×${base}` : base;
  }
  return `${Math.round(a.duration_seconds / 60)} min`;
}
