"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { SleepEntry } from "@/lib/types";
import { localDateStr } from "@/lib/logic";

// Given "23:15" bedtime and "07:00" wake on night_of, compute minutes slept,
// rolling wake into the next day when it's earlier than bedtime.
function computeMinutes(
  nightOf: string,
  bed: string,
  wake: string
): { minutes: number; bedISO: string; wakeISO: string } | null {
  if (!bed || !wake) return null;
  const bedDt = new Date(`${nightOf}T${bed}:00`);
  let wakeDt = new Date(`${nightOf}T${wake}:00`);
  if (wakeDt <= bedDt) wakeDt = new Date(wakeDt.getTime() + 24 * 3600 * 1000);
  const minutes = Math.round((wakeDt.getTime() - bedDt.getTime()) / 60000);
  return { minutes, bedISO: bedDt.toISOString(), wakeISO: wakeDt.toISOString() };
}

function fmtDuration(min: number | null): string {
  if (min == null) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export default function SleepClient({
  initialEntries,
}: {
  initialEntries: SleepEntry[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [entries, setEntries] = useState(initialEntries);

  const [nightOf, setNightOf] = useState(localDateStr());
  const [bedtime, setBedtime] = useState("23:00");
  const [wake, setWake] = useState("07:00");
  const [quality, setQuality] = useState(4);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const preview = computeMinutes(nightOf, bedtime, wake);

  async function save() {
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const calc = computeMinutes(nightOf, bedtime, wake);
      const row = {
        user_id: user.id,
        night_of: nightOf,
        bedtime: calc?.bedISO ?? null,
        wake_time: calc?.wakeISO ?? null,
        duration_minutes: calc?.minutes ?? null,
        quality,
        notes: notes || null,
      };

      const { data, error } = await supabase
        .from("sleep_entries")
        .upsert(row, { onConflict: "user_id,night_of" })
        .select()
        .single();
      if (error) throw error;

      setEntries((prev) => {
        const without = prev.filter((e) => e.night_of !== nightOf);
        return [data as SleepEntry, ...without].sort((a, b) =>
          a.night_of < b.night_of ? 1 : -1
        );
      });
      setNotes("");
    } catch (e) {
      alert("Could not save sleep: " + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const avg7 = useMemo(() => {
    const recent = entries
      .slice(0, 7)
      .map((e) => e.duration_minutes)
      .filter((m): m is number => m != null);
    if (recent.length === 0) return null;
    return Math.round(recent.reduce((a, b) => a + b, 0) / recent.length);
  }, [entries]);

  return (
    <div className="px-4 pt-6">
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="text-3xl font-bold">Sleep</h1>
        {avg7 != null && (
          <span className="text-muted">7-day avg {fmtDuration(avg7)}</span>
        )}
      </div>

      {/* Log form */}
      <div className="space-y-3 rounded-2xl bg-surface p-4">
        <Row label="Night of">
          <input
            type="date"
            value={nightOf}
            max={localDateStr()}
            onChange={(e) => setNightOf(e.target.value)}
            className="bg-transparent text-right text-lg outline-none"
          />
        </Row>
        <Row label="Bedtime">
          <input
            type="time"
            value={bedtime}
            onChange={(e) => setBedtime(e.target.value)}
            className="bg-transparent text-right text-lg outline-none"
          />
        </Row>
        <Row label="Wake time">
          <input
            type="time"
            value={wake}
            onChange={(e) => setWake(e.target.value)}
            className="bg-transparent text-right text-lg outline-none"
          />
        </Row>
        <Row label="Duration">
          <span className="text-lg text-gold">
            {fmtDuration(preview?.minutes ?? null)}
          </span>
        </Row>
        <div className="flex items-center justify-between pt-1">
          <span className="text-lg">Quality</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((q) => (
              <button
                key={q}
                onClick={() => setQuality(q)}
                className={`h-9 w-9 rounded-full text-sm font-semibold ${
                  q <= quality
                    ? "bg-gold text-black"
                    : "bg-surface-2 text-muted"
                }`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Notes (dreams, caffeine, wake-ups…)"
          className="w-full rounded-xl bg-surface-2 px-3 py-2 outline-none placeholder:text-muted"
        />
        <button
          onClick={save}
          disabled={saving}
          className="w-full rounded-xl bg-accent py-3 font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save sleep"}
        </button>
      </div>

      {/* History */}
      <h2 className="mb-3 mt-8 text-lg font-semibold text-muted">Recent</h2>
      <div className="space-y-2">
        {entries.length === 0 && (
          <p className="text-muted">No sleep logged yet.</p>
        )}
        {entries.map((e) => (
          <div
            key={e.id}
            className="flex items-center justify-between rounded-xl bg-surface px-4 py-3"
          >
            <div>
              <div className="font-medium">
                {new Date(e.night_of + "T00:00:00").toLocaleDateString(
                  undefined,
                  { weekday: "short", month: "short", day: "numeric" }
                )}
              </div>
              {e.notes && (
                <div className="max-w-[12rem] truncate text-sm text-muted">
                  {e.notes}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-lg text-gold">
                {fmtDuration(e.duration_minutes)}
              </div>
              <div className="text-sm text-muted">
                {e.quality ? "★".repeat(e.quality) : ""}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-lg">{label}</span>
      {children}
    </div>
  );
}
