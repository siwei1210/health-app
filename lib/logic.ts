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

// Plate calculator. `available` is the plates you actually own (per side).
// Denominations offered in the plate-inventory editor:
export const COMMON_PLATES = [45, 35, 25, 15, 10, 5, 3, 2.5, 2, 1.25, 1, 0.5];
// Default inventory: 35/25/15/10/3/2/1 lb plates (no 2.5, no 5, no 45).
export const DEFAULT_OWNED_PLATES = [35, 25, 15, 10, 3, 2, 1];

export function platesPerSide(
  totalWeight: number,
  barWeight: number,
  available: number[] = DEFAULT_OWNED_PLATES
): { plate: number; count: number }[] {
  let perSide = (totalWeight - barWeight) / 2;
  if (perSide <= 1e-9) return [];
  const sorted = [...available].filter((p) => p > 0).sort((a, b) => b - a);
  const result: { plate: number; count: number }[] = [];
  for (const plate of sorted) {
    let count = 0;
    while (perSide >= plate - 1e-9) {
      perSide -= plate;
      count++;
    }
    if (count > 0) result.push({ plate, count });
  }
  return result;
}

// Total weight actually achievable with the given plate breakdown.
export function loadedWeight(
  plates: { plate: number; count: number }[],
  barWeight: number
): number {
  const perSide = plates.reduce((s, p) => s + p.plate * p.count, 0);
  return roundWeight(barWeight + perSide * 2);
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
