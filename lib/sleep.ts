import type { SleepEntry } from "./types";

// Nightly sleep score (0–100) combining several signals with fixed weights:
//   Duration 40% · Bedtime consistency 20% · Wake consistency 15% ·
//   Quality 15% · Interruptions 5% · Factors (hygiene) 5%
// Consistency compares the night to your rolling average; until there are a
// few prior nights it uses a neutral value so new users aren't penalized.

export type ScoreParts = {
  duration: number;
  bedtime: number;
  wake: number;
  quality: number;
  symptoms: number;
  factors: number;
};

const WEIGHTS: ScoreParts = {
  duration: 0.4,
  bedtime: 0.2,
  wake: 0.15,
  quality: 0.15,
  symptoms: 0.06,
  factors: 0.04,
};

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

function localMinutes(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

// Evening-centered so late-night vs after-midnight bedtimes average sanely.
function bedtimeMinutes(iso: string): number {
  const m = localMinutes(iso);
  return m < 12 * 60 ? m + 24 * 60 : m;
}

function consistency(value: number, history: number[]): number {
  const avg = history.reduce((a, b) => a + b, 0) / history.length;
  const dev = Math.abs(value - avg);
  return clamp(100 - Math.max(0, dev - 15) * 1.3); // within 15 min ≈ perfect
}

function durationScore(mins: number): number {
  if (mins >= 420 && mins <= 540) return 100; // 7–9h sweet spot
  if (mins < 420) return clamp(100 - (420 - mins) * 0.5);
  return clamp(100 - (mins - 540) * 0.25); // oversleeping penalized less
}

// `all` is the full list; prior nights are derived by date.
export function sleepScore(
  entry: SleepEntry,
  all: SleepEntry[]
): { score: number; parts: ScoreParts } | null {
  if (entry.duration_minutes == null) return null;

  const prior = all
    .filter((e) => e.night_of < entry.night_of)
    .sort((a, b) => (a.night_of < b.night_of ? 1 : -1));

  const priorBed = prior
    .filter((e) => e.bedtime)
    .slice(0, 14)
    .map((e) => bedtimeMinutes(e.bedtime as string));
  const priorWake = prior
    .filter((e) => e.wake_time)
    .slice(0, 14)
    .map((e) => localMinutes(e.wake_time as string));

  const parts: ScoreParts = {
    duration: durationScore(entry.duration_minutes),
    bedtime:
      entry.bedtime && priorBed.length >= 3
        ? consistency(bedtimeMinutes(entry.bedtime), priorBed)
        : 80,
    wake:
      entry.wake_time && priorWake.length >= 3
        ? consistency(localMinutes(entry.wake_time), priorWake)
        : 80,
    quality: entry.quality ? (entry.quality / 5) * 100 : 60,
    symptoms: (() => {
      const s = (entry.symptoms ?? "").toLowerCase();
      if (s === "both") return 20;
      if (s) return 40; // headache or eye twitching
      return 100;
    })(),
    factors: (() => {
      let f = 100;
      if (entry.alcohol) f -= 50;
      if (entry.stress != null && entry.stress >= 4) f -= 30;
      if (entry.awake_minutes != null)
        f -= Math.min(40, entry.awake_minutes * 1.5);
      return clamp(f);
    })(),
  };

  const score = clamp(
    Math.round(
      (Object.keys(WEIGHTS) as (keyof ScoreParts)[]).reduce(
        (sum, k) => sum + parts[k] * WEIGHTS[k],
        0
      )
    )
  );
  return { score, parts };
}

// Color band + label for a score.
export function scoreBand(score: number): {
  label: string;
  text: string;
  bg: string;
} {
  if (score >= 85) return { label: "Excellent", text: "text-emerald-500", bg: "bg-emerald-500" };
  if (score >= 70) return { label: "Good", text: "text-lime-500", bg: "bg-lime-500" };
  if (score >= 55) return { label: "Fair", text: "text-amber-500", bg: "bg-amber-500" };
  return { label: "Poor", text: "text-red-500", bg: "bg-red-500" };
}
