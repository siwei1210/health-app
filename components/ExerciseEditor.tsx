"use client";

import { useState } from "react";
import type { Exercise } from "@/lib/types";
import { formatWeight, platesPerSide, roundWeight } from "@/lib/logic";

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

  function patch(p: Partial<Exercise>) {
    setEx((e) => ({ ...e, ...p }));
  }

  const plates = platesPerSide(ex.current_weight, ex.bar_weight);
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
        <div className="mb-1 text-center text-xl font-semibold">{ex.name}</div>
        <div className="mb-5 text-center text-muted">
          {formatWeight(ex.current_weight, unit)} ({formatWeight(perSide, unit)}
          /side)
        </div>

        {/* Weight controls */}
        <div className="grid grid-cols-4 gap-2">
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
            Deload
          </button>
          <button
            onClick={() =>
              patch({
                current_weight: Math.max(0, ex.current_weight - 5),
              })
            }
            className="rounded-xl bg-surface-2 py-3 font-medium"
          >
            −5
          </button>
          <button
            onClick={() => patch({ current_weight: ex.current_weight + 5 })}
            className="rounded-xl bg-surface-2 py-3 font-medium"
          >
            +5
          </button>
          <div className="flex items-center rounded-xl bg-surface-2 px-2">
            <input
              type="number"
              inputMode="decimal"
              value={ex.current_weight}
              onChange={(e) =>
                patch({ current_weight: Number(e.target.value) })
              }
              className="w-full bg-transparent text-center text-lg outline-none"
            />
          </div>
        </div>

        {/* Plate calculator */}
        <div className="mt-4 rounded-2xl bg-surface-2 p-4">
          <div className="mb-2 text-sm text-muted">
            Plates per side (bar {formatWeight(ex.bar_weight, unit)})
          </div>
          {plates.length === 0 ? (
            <div className="text-muted">Just the bar</div>
          ) : (
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
          )}
        </div>

        {/* Config grid */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field label="Sets">
            <NumInput
              value={ex.sets}
              onChange={(v) => patch({ sets: Math.max(1, Math.round(v)) })}
            />
          </Field>
          <Field label="Reps">
            <NumInput
              value={ex.reps}
              onChange={(v) => patch({ reps: Math.max(1, Math.round(v)) })}
            />
          </Field>
          <Field label={`Increment (${unit})`}>
            <NumInput
              value={ex.increment}
              onChange={(v) => patch({ increment: v })}
            />
          </Field>
          <Field label="Deload %">
            <NumInput
              value={ex.deload_pct}
              onChange={(v) => patch({ deload_pct: v })}
            />
          </Field>
          <Field label={`Bar weight (${unit})`}>
            <NumInput
              value={ex.bar_weight}
              onChange={(v) => patch({ bar_weight: v })}
            />
          </Field>
          <Field label="Deload after N fails">
            <NumInput
              value={ex.deload_after_fails}
              onChange={(v) =>
                patch({ deload_after_fails: Math.max(1, Math.round(v)) })
              }
            />
          </Field>
        </div>

        <button
          onClick={() => onSave(ex)}
          className="mt-6 w-full rounded-2xl bg-accent py-4 text-lg font-semibold"
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

function NumInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="rounded-xl bg-surface-2 px-3 py-2.5 text-lg outline-none"
    />
  );
}
