// Activity types for the general training log. `metric` decides which input
// the logger shows: "duration" = minutes (cardio/recovery), "hold" = seconds
// with optional sets (e.g. dead hang).
export type ActivityMetric = "duration" | "hold";

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
  { key: "walk", label: "Walk / Recovery", emoji: "🚶", metric: "duration", color: "#0a84ff" }, // blue
  { key: "dead_hang", label: "Dead hang", emoji: "🧗", metric: "hold", color: "#34c759" }, // green
  { key: "stretch", label: "Stretch / Mobility", emoji: "🧘", metric: "duration", color: "#5ac8fa" }, // teal
  { key: "cardio", label: "Cardio", emoji: "🚴", metric: "duration", color: "#af52de" }, // purple
  { key: "other", label: "Other", emoji: "⭐", metric: "duration", color: "#8e8e93" }, // gray
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

// Human-readable primary metric, e.g. "10 min" or "3×30s".
export function formatActivityMetric(a: {
  type: string;
  duration_seconds: number | null;
  sets: number | null;
}): string {
  if (a.duration_seconds == null) return "";
  const t = activityType(a.type);
  if (t.metric === "hold") {
    const s = a.duration_seconds;
    const base = s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
    return a.sets ? `${a.sets}×${base}` : base;
  }
  return `${Math.round(a.duration_seconds / 60)} min`;
}
