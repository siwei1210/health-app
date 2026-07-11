"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Exercise } from "@/lib/types";
import {
  applyProgression,
  formatWeight,
  isExerciseSuccess,
  localDateStr,
} from "@/lib/logic";
import ExerciseEditor from "./ExerciseEditor";
import SetCircle from "./SetCircle";
import RestTimer from "./RestTimer";

export type TemplateWithExercises = {
  id: string;
  name: string;
  exercises: Exercise[];
};

// Local per-exercise logging state: reps per set (null = not logged yet).
type Log = Record<string, (number | null)[]>;

export default function WorkoutClient({
  templates,
  startIndex,
  unit,
}: {
  templates: TemplateWithExercises[];
  startIndex: number;
  unit: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [tplIndex, setTplIndex] = useState(startIndex);
  // Local editable copy of exercises so weight edits reflect instantly.
  const [exMap, setExMap] = useState<Record<string, Exercise>>(() =>
    Object.fromEntries(
      templates.flatMap((t) => t.exercises).map((e) => [e.id, e])
    )
  );
  const [log, setLog] = useState<Log>({});
  const [bodyWeight, setBodyWeight] = useState("");
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [saving, setSaving] = useState(false);
  const [restKey, setRestKey] = useState(0); // bump to (re)start rest timer

  const startedAt = useRef<number | null>(null);

  const template = templates[tplIndex];

  if (!template) {
    return (
      <div className="p-6 text-center text-muted">
        <p className="mt-20">
          No program found. Run the schema SQL in Supabase, then reload.
        </p>
      </div>
    );
  }

  function setsFor(ex: Exercise): (number | null)[] {
    return log[ex.id] ?? Array(ex.sets).fill(null);
  }

  function tapSet(ex: Exercise, setIdx: number) {
    if (startedAt.current === null) startedAt.current = Date.now();
    setLog((prev) => {
      const cur = [...(prev[ex.id] ?? Array(ex.sets).fill(null))];
      const v = cur[setIdx];
      // cycle: null -> target -> target-1 -> ... -> 0 -> null
      if (v === null) cur[setIdx] = ex.reps;
      else if (v > 0) cur[setIdx] = v - 1;
      else cur[setIdx] = null;
      return { ...prev, [ex.id]: cur };
    });
    setRestKey((k) => k + 1); // restart rest timer on each logged tap
  }

  function persistExercise(next: Exercise) {
    setExMap((m) => ({ ...m, [next.id]: next }));
    // fire-and-forget persist of manual config edits
    supabase
      .from("exercises")
      .update({
        current_weight: next.current_weight,
        increment: next.increment,
        deload_pct: next.deload_pct,
        sets: next.sets,
        reps: next.reps,
        bar_weight: next.bar_weight,
      })
      .eq("id", next.id)
      .then(() => {});
  }

  async function finish() {
    setSaving(true);
    try {
      const attempted = template.exercises
        .map((e) => exMap[e.id] ?? e)
        .filter((e) => (log[e.id] ?? []).some((r) => r !== null));

      if (attempted.length === 0) {
        setSaving(false);
        alert("Log at least one set before finishing.");
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const duration =
        startedAt.current !== null
          ? Math.round((Date.now() - startedAt.current) / 1000)
          : null;

      const { data: session, error: sErr } = await supabase
        .from("workout_sessions")
        .insert({
          user_id: user.id,
          template_id: template.id,
          template_name: template.name,
          performed_at: localDateStr(),
          body_weight: bodyWeight ? Number(bodyWeight) : null,
          notes: notes || null,
          duration_seconds: duration,
        })
        .select()
        .single();
      if (sErr || !session) throw sErr ?? new Error("session insert failed");

      for (let i = 0; i < attempted.length; i++) {
        const ex = attempted[i];
        const sets = setsFor(ex);
        const logged = sets.map((r) => r ?? 0);

        const { data: se, error: seErr } = await supabase
          .from("session_exercises")
          .insert({
            session_id: session.id,
            exercise_id: ex.id,
            exercise_name: ex.name,
            weight: ex.current_weight,
            target_sets: ex.sets,
            target_reps: ex.reps,
            sort_order: i,
          })
          .select()
          .single();
        if (seErr || !se) throw seErr ?? new Error("session_exercise failed");

        await supabase.from("session_sets").insert(
          logged.map((reps, idx) => ({
            session_exercise_id: se.id,
            set_number: idx + 1,
            reps,
            completed: sets[idx] !== null,
          }))
        );

        // Progression
        const success = isExerciseSuccess(logged, ex.sets, ex.reps);
        const prog = applyProgression(ex, success);
        await supabase
          .from("exercises")
          .update({
            current_weight: prog.current_weight,
            fail_streak: prog.fail_streak,
          })
          .eq("id", ex.id);
      }

      router.push("/history");
      router.refresh();
    } catch (e) {
      alert("Could not save workout: " + (e as Error).message);
      setSaving(false);
    }
  }

  const loggedCount = template.exercises.reduce(
    (n, e) => n + setsFor(e).filter((r) => r !== null).length,
    0
  );

  return (
    <div className="px-4 pt-6">
      {/* Header: workout selector */}
      <div className="mb-6 flex items-center justify-center gap-2">
        <select
          value={tplIndex}
          onChange={(e) => setTplIndex(Number(e.target.value))}
          className="rounded-full bg-surface px-4 py-2 text-lg font-semibold text-white outline-none"
        >
          {templates.map((t, i) => (
            <option key={t.id} value={i}>
              Workout {t.name}
            </option>
          ))}
        </select>
      </div>

      {/* Exercises */}
      <div className="space-y-7">
        {template.exercises.map((tplEx) => {
          const ex = exMap[tplEx.id] ?? tplEx;
          const sets = setsFor(ex);
          const nextIdx = sets.findIndex((r) => r === null);
          return (
            <div key={ex.id}>
              <button
                onClick={() => setEditing(ex)}
                className="flex w-full items-center justify-between"
              >
                <span className="text-2xl font-semibold">{ex.name}</span>
                <span className="flex items-baseline gap-1.5">
                  <span className="text-sm text-muted">
                    {ex.sets}×{ex.reps}
                  </span>
                  <span className="text-xl font-bold text-white">
                    {formatWeight(ex.current_weight, unit)}
                  </span>
                  <ChevronRight />
                </span>
              </button>
              <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
                {sets.map((reps, i) => (
                  <SetCircle
                    key={i}
                    reps={reps}
                    target={ex.reps}
                    active={i === nextIdx}
                    onClick={() => tapSet(ex, i)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Body weight */}
      <div className="mt-7 flex items-center justify-between rounded-2xl bg-surface px-4 py-4">
        <span className="text-lg">Body Weight</span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            inputMode="decimal"
            value={bodyWeight}
            onChange={(e) => setBodyWeight(e.target.value)}
            placeholder="—"
            className="w-24 bg-transparent text-right text-lg outline-none placeholder:text-muted"
          />
          <span className="text-lg text-muted">{unit}</span>
        </div>
      </div>

      {/* Notes */}
      {showNotes ? (
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Workout notes…"
          rows={3}
          className="mt-3 w-full rounded-2xl bg-surface px-4 py-3 outline-none placeholder:text-muted"
        />
      ) : (
        <button
          onClick={() => setShowNotes(true)}
          className="mt-3 text-accent"
        >
          + Add note
        </button>
      )}

      {/* Rest timer */}
      <div className="mt-6">
        <RestTimer key={restKey} running={loggedCount > 0} />
      </div>

      {/* Finish */}
      <button
        onClick={finish}
        disabled={saving}
        className="mt-4 w-full rounded-2xl bg-accent py-4 text-lg font-semibold disabled:opacity-50"
      >
        {saving ? "Saving…" : `Finish workout${loggedCount ? ` (${loggedCount} sets)` : ""}`}
      </button>

      {editing && (
        <ExerciseEditor
          exercise={editing}
          unit={unit}
          onClose={() => setEditing(null)}
          onSave={(next) => {
            persistExercise(next);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function ChevronRight() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="#ff3b30" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}
