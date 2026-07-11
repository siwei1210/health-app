"use client";

import { useEffect, useState } from "react";
import type { Exercise } from "@/lib/types";
import {
  COMMON_PLATES,
  DEFAULT_OWNED_PLATES,
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

  // The plates you actually own (per side), persisted on this device.
  const [ownedPlates, setOwnedPlates] = useState<number[]>(DEFAULT_OWNED_PLATES);
  const [editingPlates, setEditingPlates] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("ownedPlates");
      if (raw) setOwnedPlates(JSON.parse(raw));
    } catch {}
  }, []);

  function toggleOwnedPlate(p: number) {
    setOwnedPlates((prev) => {
      const next = (
        prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
      ).sort((a, b) => b - a);
      try {
        localStorage.setItem("ownedPlates", JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  function patch(p: Partial<Exercise>) {
    setEx((e) => ({ ...e, ...p }));
  }

  const plates = platesPerSide(ex.current_weight, ex.bar_weight, ownedPlates);
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
            aria-label="minus 5"
            onClick={() =>
              patch({ current_weight: Math.max(0, ex.current_weight - 5) })
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
            aria-label="plus 5"
            onClick={() => patch({ current_weight: ex.current_weight + 5 })}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-3xl font-light text-white active:opacity-80"
          >
            +
          </button>
        </div>
        <div className="mb-4 mt-2 text-center text-muted">
          {formatWeight(perSide, unit)} / side · {ex.sets}×{ex.reps} ={" "}
          {formatWeight(roundWeight(ex.current_weight * ex.sets * ex.reps), unit)}{" "}
          total volume
        </div>

        {/* Fine adjustments + deload */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() =>
              patch({
                current_weight: roundWeight(
                  ex.current_weight * (1 - ex.deload_pct / 100)
                ),
              })
            }
            className="rounded-xl bg-surface-2 py-3 text-sm font-medium"
          >
            Deload −{ex.deload_pct}%
          </button>
          <button
            onClick={() =>
              patch({
                current_weight: Math.max(0, roundWeight(ex.current_weight - 2)),
              })
            }
            className="rounded-xl bg-surface-2 py-3 font-medium"
          >
            −2
          </button>
          <button
            onClick={() =>
              patch({ current_weight: roundWeight(ex.current_weight + 2) })
            }
            className="rounded-xl bg-surface-2 py-3 font-medium"
          >
            +2
          </button>
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
                Tap the plates you own.
              </div>
              <div className="flex flex-wrap gap-2">
                {COMMON_PLATES.map((p) => {
                  const owned = ownedPlates.includes(p);
                  return (
                    <button
                      key={p}
                      onClick={() => toggleOwnedPlate(p)}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                        owned ? "bg-gold text-black" : "bg-surface text-muted"
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : plates.length === 0 ? (
            <div className="text-muted">Just the bar</div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {plates.map((p) => (
                  <span
                    key={p.plate}
                    className="rounded-lg bg-gold px-3 py-1 font-semibold text-black"
                  >
                    {p.count}×{p.plate}
                  </span>
                ))}
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
