// Pure domain logic: progression, plate math, formatting.

import type { Exercise } from "./types";

// Round to the nearest 0.5 to keep weights sane after % deloads.
export function roundWeight(w: number): number {
  return Math.round(w * 2) / 2;
}

// A session "succeeds" for an exercise when every target set hit target reps.
export function isExerciseSuccess(
  setsReps: number[],
  targetSets: number,
  targetReps: number
): boolean {
  if (setsReps.length < targetSets) return false;
  return setsReps.slice(0, targetSets).every((r) => r >= targetReps);
}

// Given an exercise's current state and whether the just-logged session
// succeeded, return the next working weight + new fail streak.
export function applyProgression(
  ex: Pick<
    Exercise,
    | "current_weight"
    | "increment"
    | "deload_pct"
    | "fail_streak"
    | "deload_after_fails"
    | "bar_weight"
  >,
  success: boolean
): { current_weight: number; fail_streak: number } {
  if (success) {
    return {
      current_weight: roundWeight(ex.current_weight + ex.increment),
      fail_streak: 0,
    };
  }
  const nextStreak = ex.fail_streak + 1;
  if (nextStreak >= ex.deload_after_fails) {
    const deloaded = roundWeight(
      ex.current_weight * (1 - ex.deload_pct / 100)
    );
    return { current_weight: Math.max(deloaded, ex.bar_weight ?? 45), fail_streak: 0 };
  }
  // Missed but not enough to deload — keep the same weight, try again.
  return { current_weight: ex.current_weight, fail_streak: nextStreak };
}

// Plate calculator: which plates per side to load, given total weight & bar.
const DEFAULT_PLATES = [45, 35, 25, 10, 5, 2.5, 1.25];

export function platesPerSide(
  totalWeight: number,
  barWeight: number,
  available: number[] = DEFAULT_PLATES
): { plate: number; count: number }[] {
  let perSide = (totalWeight - barWeight) / 2;
  if (perSide <= 0) return [];
  const result: { plate: number; count: number }[] = [];
  for (const plate of available) {
    let count = 0;
    while (perSide >= plate - 1e-9) {
      perSide = roundWeight(perSide - plate);
      count++;
    }
    if (count > 0) result.push({ plate, count });
  }
  return result;
}

export function formatWeight(w: number, unit = "lb"): string {
  const n = Number.isInteger(w) ? w.toString() : w.toFixed(1);
  return `${n}${unit}`;
}

// Estimated 1-rep max (Epley) — used in progress charts.
export function e1rm(weight: number, reps: number): number {
  if (reps <= 0) return 0;
  if (reps === 1) return weight;
  return roundWeight(weight * (1 + reps / 30));
}

// Local YYYY-MM-DD (avoids UTC off-by-one from toISOString()).
export function localDateStr(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
