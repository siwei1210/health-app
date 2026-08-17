// Activity types for the general training log. `metric` decides which input
// the logger shows: "duration" = minutes (cardio/recovery), "hold" = seconds
// with optional sets (e.g. dead hang).
export type ActivityMetric = "duration" | "hold";

export type ActivityTypeDef = {
  key: string;
  label: string;
  emoji: string;
  metric: ActivityMetric;
};

export const ACTIVITY_TYPES: ActivityTypeDef[] = [
  { key: "row", label: "Row", emoji: "🚣", metric: "duration" },
  { key: "walk", label: "Walk / Recovery", emoji: "🚶", metric: "duration" },
  { key: "dead_hang", label: "Dead hang", emoji: "🧗", metric: "hold" },
  { key: "stretch", label: "Stretch / Mobility", emoji: "🧘", metric: "duration" },
  { key: "cardio", label: "Cardio", emoji: "🏃", metric: "duration" },
  { key: "other", label: "Other", emoji: "⭐", metric: "duration" },
];

export function activityType(key: string): ActivityTypeDef {
  return (
    ACTIVITY_TYPES.find((t) => t.key === key) ?? {
      key,
      label: key,
      emoji: "•",
      metric: "duration",
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
