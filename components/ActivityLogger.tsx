"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Activity } from "@/lib/types";
import { localDateStr } from "@/lib/logic";
import {
  ACTIVITY_TYPES,
  activityType,
  formatActivityMetric,
} from "@/lib/activities";
import SwipeRow from "./SwipeRow";

export default function ActivityLogger({
  initialActivities,
}: {
  initialActivities: Activity[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [activities, setActivities] = useState(initialActivities);

  const [type, setType] = useState("row");
  const [date, setDate] = useState(localDateStr());
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("");
  const [sets, setSets] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const def = activityType(type);

  function reset() {
    setMinutes("");
    setSeconds("");
    setSets("");
    setNotes("");
  }

  async function save() {
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const num = (s: string) =>
        s.trim() === "" || Number.isNaN(Number(s)) ? null : Number(s);
      const duration_seconds =
        def.metric === "hold"
          ? num(seconds)
          : minutes.trim() === ""
          ? null
          : Math.round(Number(minutes) * 60);

      const row = {
        user_id: user.id,
        performed_at: date,
        type,
        duration_seconds,
        distance: null,
        sets: def.metric === "hold" ? num(sets) : null,
        notes: notes.trim() || null,
      };

      const { data, error } = await supabase
        .from("activities")
        .insert(row)
        .select()
        .single();
      if (error) throw error;

      setActivities((prev) =>
        [data as Activity, ...prev].sort((a, b) =>
          a.performed_at < b.performed_at ? 1 : -1
        )
      );
      reset();
    } catch (e) {
      alert("Could not save activity: " + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function del(id: string) {
    const prev = activities;
    setActivities((a) => a.filter((x) => x.id !== id));
    const { error } = await supabase.from("activities").delete().eq("id", id);
    if (error) {
      setActivities(prev);
      alert("Could not delete: " + error.message);
    }
  }

  return (
    <div className="px-4 pt-3">
      {/* Type picker */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        {ACTIVITY_TYPES.map((t) => (
          <button
            key={t.key}
            onClick={() => setType(t.key)}
            className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-3 text-center ${
              type === t.key
                ? "bg-accent text-white"
                : "bg-surface text-muted"
            }`}
          >
            <span className="text-2xl leading-none">{t.emoji}</span>
            <span className="text-xs font-medium leading-tight">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Log form */}
      <div className="space-y-3 rounded-2xl bg-surface p-4">
        <div className="flex items-center justify-between">
          <span className="text-lg">Date</span>
          <input
            type="date"
            value={date}
            max={localDateStr()}
            onChange={(e) => setDate(e.target.value)}
            className="bg-transparent text-right text-lg outline-none"
          />
        </div>

        {def.metric === "duration" ? (
          <div>
            <div className="flex items-center justify-between">
              <span className="text-lg">Minutes</span>
              <input
                type="number"
                inputMode="numeric"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder="—"
                className="w-24 bg-transparent text-right text-lg outline-none placeholder:text-muted"
              />
            </div>
            <div className="mt-2 flex gap-2">
              {[10, 20, 30, 45].map((m) => (
                <button
                  key={m}
                  onClick={() => setMinutes(String(m))}
                  className={`flex-1 rounded-xl py-2 text-sm font-medium ${
                    minutes === String(m)
                      ? "bg-gold text-black"
                      : "bg-surface-2 text-muted"
                  }`}
                >
                  {m}m
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-lg">Hold (seconds)</span>
              <input
                type="number"
                inputMode="numeric"
                value={seconds}
                onChange={(e) => setSeconds(e.target.value)}
                placeholder="—"
                className="w-24 bg-transparent text-right text-lg outline-none placeholder:text-muted"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-lg">Sets</span>
              <input
                type="number"
                inputMode="numeric"
                value={sets}
                onChange={(e) => setSets(e.target.value)}
                placeholder="—"
                className="w-24 bg-transparent text-right text-lg outline-none placeholder:text-muted"
              />
            </div>
          </>
        )}

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Notes…"
          className="w-full rounded-xl bg-surface-2 px-3 py-2 outline-none placeholder:text-muted"
        />
        <button
          onClick={save}
          disabled={saving}
          className="w-full rounded-xl bg-accent py-3 font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : `Log ${def.label}`}
        </button>
      </div>

      {/* Recent */}
      <h2 className="mb-3 mt-8 text-lg font-semibold text-muted">Recent</h2>
      <div className="space-y-2">
        {activities.length === 0 && (
          <p className="text-muted">No activities logged yet.</p>
        )}
        {activities.map((a) => {
          const t = activityType(a.type);
          return (
            <SwipeRow key={a.id} onDelete={() => del(a.id)}>
              <div className="flex w-full items-center justify-between bg-surface px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="text-2xl">{t.emoji}</span>
                  <div className="min-w-0">
                    <div className="font-medium">{t.label}</div>
                    <div className="text-sm text-muted">
                      {new Date(a.performed_at + "T00:00:00").toLocaleDateString(
                        undefined,
                        { weekday: "short", month: "short", day: "numeric" }
                      )}
                    </div>
                    {a.notes && (
                      <div className="mt-0.5 whitespace-pre-wrap break-words text-sm text-muted">
                        {a.notes}
                      </div>
                    )}
                  </div>
                </div>
                <div className="ml-3 shrink-0 text-lg font-semibold text-gold">
                  {formatActivityMetric(a)}
                </div>
              </div>
            </SwipeRow>
          );
        })}
      </div>
    </div>
  );
}
