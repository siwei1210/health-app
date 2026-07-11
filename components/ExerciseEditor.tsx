"use client";

import { useEffect, useState } from "react";
import type { Exercise } from "@/lib/types";
import {
  COMMON_PLATES,
  DEFAULT_PLATE_INVENTORY,
  type PlateCount,
  formatWeight,
  loadedWeight,
  platesPerSide,
  roundWeight,
} from "@/lib/logic";

// Bottom-sheet editor for an exercise: working weight, sets×reps, increment,
// deload, plus a live plate calculator. Mirrors the app's "Weights" screen.
export default function ExerciseEditor({
  exercise,
  unit,
  onClose,
  onSave,
}: {
  exercise: Exercise;
  unit: string;
  onClose: () => void;
  onSave: (next: Exercise) => void;
}) {
  const [ex, setEx] = useState<Exercise>(exercise);

  // Total plates you own (each denomination), persisted on this device.
  const [inventory, setInventory] = useState<PlateCount[]>(
    DEFAULT_PLATE_INVENTORY
  );
  const [editingPlates, setEditingPlates] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("plateInventory");
      if (raw) setInventory(JSON.parse(raw));
    } catch {}
  }, []);

  function setPlateCount(plate: number, count: number) {
    setInventory((prev) => {
      const c = Math.max(0, count);
      const others = prev.filter((p) => p.plate !== plate);
      const next = [...others, { plate, count: c }].sort(
        (a, b) => b.plate - a.plate
      );
      try {
        localStorage.setItem("plateInventory", JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  function countOf(plate: number): number {
    return inventory.find((p) => p.plate === plate)?.count ?? 0;
  }

  function patch(p: Partial<Exercise>) {
    setEx((e) => ({ ...e, ...p }));
  }

  const plates = platesPerSide(ex.current_weight, ex.bar_weight, inventory);
  const achieved = loadedWeight(plates, ex.bar_weight);
  const perSide = Math.max(0, roundWeight((ex.current_weight - ex.bar_weight) / 2));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl bg-surface p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-hair" />
        <div className="mb-3 text-center text-base font-medium text-muted">
          {ex.name}
        </div>

        {/* Total weight — the hero number, stepped by big −/+ buttons */}
        <div className="mb-1 text-center text-xs font-semibold uppercase tracking-widest text-muted">
          Total weight
        </div>
        <div className="flex items-center justify-center gap-4">
          <button
            aria-label="minus 2"
            onClick={() =>
              patch({ current_weight: Math.max(0, ex.current_weight - 2) })
            }
            className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-2 text-3xl font-light active:bg-hair"
          >
            −
          </button>
          <div className="flex items-baseline justify-center">
            <NumInput
              value={ex.current_weight}
              min={0}
              onChange={(v) => patch({ current_weight: v })}
              className="w-36 bg-transparent text-center text-6xl font-bold tabular-nums outline-none"
            />
            <span className="ml-1 text-2xl font-semibold text-muted">{unit}</span>
          </div>
          <button
            aria-label="plus 2"
            onClick={() => patch({ current_weight: ex.current_weight + 2 })}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-3xl font-light text-white active:opacity-80"
          >
            +
          </button>
        </div>
        <div className="mb-2 mt-2 text-center text-muted">
          {formatWeight(perSide, unit)} / side · {ex.sets}×{ex.reps} ={" "}
          {formatWeight(roundWeight(ex.current_weight * ex.sets * ex.reps), unit)}{" "}
          total volume
        </div>

        {/* Plate calculator */}
        <div className="mt-4 rounded-2xl bg-surface-2 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-muted">
              Plates per side (bar {formatWeight(ex.bar_weight, unit)})
            </span>
            <button
              onClick={() => setEditingPlates((v) => !v)}
              className="text-sm font-medium text-gold"
            >
              {editingPlates ? "Done" : "Edit plates"}
            </button>
          </div>

          {editingPlates ? (
            <div>
              <div className="mb-2 text-xs text-muted">
                How many of each plate you own (total). Plates load in pairs, so
                you need 2 of a size to use it.
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {COMMON_PLATES.map((p) => {
                  const count = countOf(p);
                  return (
                    <div
                      key={p}
                      className="flex items-center justify-between py-1"
                    >
                      <span className="flex items-center gap-2 text-sm">
                        <span
                          className={`inline-block h-3.5 w-3.5 rounded-full ${plateSwatch(
                            p
                          )}`}
                        />
                        {p} lb
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setPlateCount(p, count - 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-surface text-lg leading-none"
                        >
                          −
                        </button>
                        <span className="w-4 text-center text-sm tabular-nums">
                          {count}
                        </span>
                        <button
                          onClick={() => setPlateCount(p, count + 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-surface text-lg leading-none"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : plates.length === 0 ? (
            <div className="text-muted">Just the bar</div>
          ) : (
            <>
              {/* One chip per physical plate so you can count each color. */}
              <div className="flex flex-wrap gap-2">
                {plates.flatMap((p) =>
                  Array.from({ length: p.count }, (_, i) => (
                    <span
                      key={`${p.plate}-${i}`}
                      className={`rounded-lg px-3 py-1 font-semibold ${plateChip(
                        p.plate
                      )}`}
                    >
                      {p.plate}
                    </span>
                  ))
                )}
              </div>
              {Math.abs(achieved - ex.current_weight) > 1e-6 && (
                <div className="mt-2 text-xs text-accent">
                  Closest with your plates: {formatWeight(achieved, unit)} (target{" "}
                  {formatWeight(ex.current_weight, unit)}). Tap “Edit plates” to
                  adjust.
                </div>
              )}
            </>
          )}
        </div>

        {/* Config grid */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field label="Sets">
            <NumInput
              value={ex.sets}
              min={1}
              integer
              onChange={(v) => patch({ sets: v })}
            />
          </Field>
          <Field label="Reps">
            <NumInput
              value={ex.reps}
              min={1}
              integer
              onChange={(v) => patch({ reps: v })}
            />
          </Field>
          <Field label={`Increment (${unit})`}>
            <NumInput
              value={ex.increment}
              min={0}
              onChange={(v) => patch({ increment: v })}
            />
          </Field>
          <Field label="Deload %">
            <NumInput
              value={ex.deload_pct}
              min={0}
              onChange={(v) => patch({ deload_pct: v })}
            />
          </Field>
          <Field label={`Bar weight (${unit})`}>
            <NumInput
              value={ex.bar_weight}
              min={0}
              onChange={(v) => patch({ bar_weight: v })}
            />
          </Field>
          <Field label="Deload after N fails">
            <NumInput
              value={ex.deload_after_fails}
              min={1}
              integer
              onChange={(v) => patch({ deload_after_fails: v })}
            />
          </Field>
        </div>

        <button
          onClick={() => onSave(ex)}
          className="mt-6 w-full rounded-2xl bg-accent py-4 text-lg font-semibold text-white"
        >
          Save
        </button>
      </div>
    </div>
  );
}

// Real-world plate colors: 1 lb white, 2 lb green, 3 lb yellow, rest black.
function plateChip(plate: number): string {
  switch (plate) {
    case 1:
      return "bg-white text-black ring-1 ring-black/20";
    case 2:
      return "bg-green-600 text-white";
    case 3:
      return "bg-yellow-400 text-black";
    default:
      return "bg-neutral-900 text-white ring-1 ring-white/25";
  }
}

function plateSwatch(plate: number): string {
  switch (plate) {
    case 1:
      return "bg-white ring-1 ring-black/25";
    case 2:
      return "bg-green-600";
    case 3:
      return "bg-yellow-400";
    default:
      return "bg-neutral-900 ring-1 ring-white/30";
  }
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      {children}
    </label>
  );
}

// Numeric input that lets you clear the field and type freely. It holds a
// raw string draft while focused (so the value can be temporarily empty) and
// only clamps / normalizes on blur — fixing the "can't delete, snaps to 1" bug.
function NumInput({
  value,
  onChange,
  min,
  integer,
  className = "rounded-xl bg-surface-2 px-3 py-2.5 text-lg outline-none",
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  integer?: boolean;
  className?: string;
}) {
  const [draft, setDraft] = useState(String(value));

  // Re-sync when the value changes from the outside (e.g. +/- buttons), but
  // not while the user is mid-edit typing the same number.
  useEffect(() => {
    if (Number(draft) !== value) setDraft(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function normalize(raw: string) {
    if (raw.trim() === "" || Number.isNaN(Number(raw))) {
      setDraft(String(value)); // revert empties/garbage to the last good value
      return;
    }
    let n = Number(raw);
    if (integer) n = Math.round(n);
    if (min !== undefined) n = Math.max(min, n);
    setDraft(String(n));
    onChange(n);
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={draft}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
        // Live-update only when it's a valid number; don't clamp yet so the
        // user can freely delete and retype.
        if (raw.trim() !== "" && !Number.isNaN(Number(raw))) {
          onChange(integer ? Math.round(Number(raw)) : Number(raw));
        }
      }}
      onBlur={(e) => normalize(e.target.value)}
      className={className}
    />
  );
}
