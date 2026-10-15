// Pure domain logic: progression, plate math, formatting.

import type { Exercise } from "./types";

// Round to the nearest 0.5 to keep weights sane after % deloads.
export function roundWeight(w: number): number {
  return Math.round(w * 2) / 2;
}

// Round to the nearest ODD whole number. Barbell weights read cleanest on odd
// numbers (a 45 lb bar plus paired plates lands on odd totals), and the user
// prefers them, so auto-calculated next weights snap to odd. `prefer` breaks an
// exact even tie: up after a gain (keep progressing), down after a deload.
// Manual edits are never forced through this — the user can always override.
export function roundToOdd(w: number, prefer: 1 | -1 = 1): number {
  const r = Math.round(w);
  if (Math.abs(r) % 2 === 1) return r; // already odd
  const up = r + 1;
  const down = r - 1;
  const dUp = Math.abs(up - w);
  const dDown = Math.abs(w - down);
  if (dUp < dDown) return up;
  if (dDown < dUp) return down;
  return prefer === 1 ? up : down; // exact tie → direction of the change
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
      current_weight: roundToOdd(ex.current_weight + ex.increment, 1),
      fail_streak: 0,
    };
  }
  const nextStreak = ex.fail_streak + 1;
  if (nextStreak >= ex.deload_after_fails) {
    const deloaded = roundToOdd(
      ex.current_weight * (1 - ex.deload_pct / 100),
      -1
    );
    return { current_weight: Math.max(deloaded, ex.bar_weight ?? 45), fail_streak: 0 };
  }
  // Missed but not enough to deload — keep the same weight, try again.
  return { current_weight: ex.current_weight, fail_streak: nextStreak };
}

// Plate calculator. Inventory is the *total* number of each plate you own;
// plates load in pairs, so per side you can use floor(count / 2) of each.
export type PlateCount = { plate: number; count: number };

// Denominations offered in the plate-inventory editor:
export const COMMON_PLATES = [45, 35, 25, 15, 10, 5, 3, 2.5, 2, 1.25, 1, 0.5];

// Default inventory (total owned). Small plates match the user's real set:
// one 3 lb, two 2 lb, two 1 lb; larger plates assumed plentiful (editable).
export const DEFAULT_PLATE_INVENTORY: PlateCount[] = [
  { plate: 45, count: 0 },
  { plate: 35, count: 4 },
  { plate: 25, count: 4 },
  { plate: 15, count: 4 },
  { plate: 10, count: 4 },
  { plate: 5, count: 0 },
  { plate: 3, count: 1 },
  { plate: 2, count: 2 },
  { plate: 1, count: 2 },
];

export function platesPerSide(
  totalWeight: number,
  barWeight: number,
  inventory: PlateCount[] = DEFAULT_PLATE_INVENTORY
): PlateCount[] {
  let perSide = (totalWeight - barWeight) / 2;
  if (perSide <= 1e-9) return [];
  // How many of each plate are usable per side (need a pair to balance).
  const perSideAvail = inventory
    .map((p) => ({ plate: p.plate, count: Math.floor(p.count / 2) }))
    .filter((p) => p.plate > 0 && p.count > 0)
    .sort((a, b) => b.plate - a.plate);
  const result: PlateCount[] = [];
  for (const { plate, count } of perSideAvail) {
    let used = 0;
    while (used < count && perSide >= plate - 1e-9) {
      perSide -= plate;
      used++;
    }
    if (used > 0) result.push({ plate, count: used });
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
