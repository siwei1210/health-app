"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { SleepEntry } from "@/lib/types";
import { localDateStr } from "@/lib/logic";
import { sleepScore, scoreBand } from "@/lib/sleep";
import CopyButton from "./CopyButton";
import SwipeRow from "./SwipeRow";

// Extra nightly detail fields (kept in one object to limit boilerplate).
type Details = {
  latency: string;
  awake: string;
  exercise: string; // "" | rest | strength | cardio | both
  alcohol: boolean;
  stress: number | null;
  roomTemp: string; // "64" | "69" | "75"
  morning: number | null; // combined energy & mood (1..5)
  symptoms: string; // "" | headache | eye twitching | both
  nap: string;
};
const EMPTY_DETAILS: Details = {
  latency: "",
  awake: "",
  exercise: "",
  alcohol: false,
  stress: null,
  roomTemp: "",
  morning: null,
  symptoms: "",
  nap: "",
};
const EXERCISE_OPTS = ["rest", "strength", "cardio", "both"];
const ROOM_TEMP_OPTS = [
  { v: "64", label: "Winter 64°" },
  { v: "69", label: "Mild 69°" },
  { v: "75", label: "Summer 75°" },
];
const SYMPTOM_OPTS = [
  { v: "", label: "None" },
  { v: "headache", label: "Headache" },
  { v: "eye twitching", label: "Eye twitching" },
  { v: "both", label: "Both" },
];

// Factors offered by default; the chip list also includes anything you've
// tagged before, so new factors stick around once used.
const DEFAULT_FACTORS = [
  "Sleep tea",
  "No caffeine",
  "No screens",
  "Magnesium",
  "Exercise",
  "Alcohol",
  "Late meal",
  "Read before bed",
];

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

function fmtHours(min: number): string {
  return `${(min / 60).toFixed(1)}h`;
}

function mean(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

// Quality 1–5 → color + label. 1–2 bad, 3 not great, 4 good, 5 excellent 🎉
const QUALITY_META: Record<
  number,
  { bg: string; text: string; label: string; emoji: string }
> = {
  1: { bg: "bg-red-600", text: "text-red-500", label: "Bad", emoji: "😖" },
  2: { bg: "bg-orange-500", text: "text-orange-500", label: "Bad", emoji: "😕" },
  3: { bg: "bg-amber-400", text: "text-amber-500", label: "Not great", emoji: "😐" },
  4: { bg: "bg-emerald-500", text: "text-emerald-500", label: "Good", emoji: "🙂" },
  5: { bg: "bg-emerald-400", text: "text-emerald-400", label: "Excellent!", emoji: "🎉" },
};

function qualityBg(q: number | null): string {
  return q ? QUALITY_META[q].bg : "bg-gold";
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface p-3 text-center">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-lg font-semibold text-gold">{value}</div>
    </div>
  );
}

function ScoreTile({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-2xl bg-surface p-3 text-center">
      <div className="text-xs text-muted">{label}</div>
      <div
        className={`text-2xl font-bold ${
          value != null ? scoreBand(value).text : "text-muted"
        }`}
      >
        {value ?? "—"}
      </div>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const band = scoreBand(score);
  return (
    <div
      className={`flex h-11 w-11 flex-col items-center justify-center rounded-full ${band.bg} text-white`}
      title={`${band.label} · ${score}/100`}
    >
      <span className="text-sm font-bold leading-none">{score}</span>
    </div>
  );
}

// Compact numeric input used in the "More detail" fields.
function NumField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="—"
      className="w-20 bg-transparent text-right text-lg outline-none placeholder:text-muted"
    />
  );
}

function YesNo({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`rounded-full px-4 py-1.5 text-sm font-medium ${
        value ? "bg-gold text-black" : "bg-surface-2 text-muted"
      }`}
    >
      {value ? "Yes" : "No"}
    </button>
  );
}

function Scale5({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(value === n ? null : n)}
          className={`h-9 w-9 rounded-full text-sm font-semibold ${
            value === n ? "bg-gold text-black" : "bg-surface-2 text-muted"
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

// A label with content below it (for wide controls like the 1–5 scales).
function Between({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted">{label}</span>
      {children}
    </div>
  );
}

// A little celebratory burst for a 5/5 night.
function Confetti() {
  const pieces = ["🎉", "✨", "🎊", "⭐", "💛", "🎉", "✨", "🎊"];
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
      {pieces.map((e, i) => (
        <span
          key={i}
          className="confetti-piece absolute text-lg"
          style={{ "--a": `${Math.round((i / pieces.length) * 360)}deg` } as Record<string, string>}
        >
          {e}
        </span>
      ))}
    </div>
  );
}

function hhmm(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// A Markdown table of the whole sleep log, ready to paste into an AI chat.
function formatSleepExport(rows: SleepEntry[]): string {
  const sorted = [...rows].sort((a, b) => (a.night_of < b.night_of ? -1 : 1));
  const durs = sorted
    .map((e) => e.duration_minutes)
    .filter((m): m is number => m != null);
  const lines: string[] = [];
  lines.push(`# Sleep log (exported ${localDateStr()})`);
  lines.push(`Nights logged: ${sorted.length}`);
  if (durs.length)
    lines.push(`Average duration: ${fmtDuration(Math.round(mean(durs)))}`);
  lines.push(
    "Sleep score (0–100): duration 40%, bedtime consistency 20%, wake consistency 15%, quality 15%, symptoms 6%, factors 4%."
  );
  lines.push("");
  lines.push(
    "| Date | Score | Duration | Quality | Bedtime | Wake | Latency(min) | AwakeMin | Exercise | Alcohol | Stress | RoomTemp | Morning | Nap(min) | Symptoms | Factors | Notes |"
  );
  lines.push(
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|"
  );
  const yn = (b: boolean | null) => (b == null ? "" : b ? "yes" : "no");
  const num = (n: number | null | undefined) => (n == null ? "" : String(n));
  for (const e of sorted) {
    const dur = e.duration_minutes != null ? fmtDuration(e.duration_minutes) : "";
    const q = e.quality != null ? `${e.quality}/5` : "";
    const score = sleepScore(e, sorted)?.score ?? "";
    const factors = (e.tags ?? []).join(", ");
    const clean = (s: string | null) =>
      (s ?? "").replace(/\r?\n/g, " ").replace(/\|/g, "/");
    lines.push(
      `| ${e.night_of} | ${score} | ${dur} | ${q} | ${hhmm(e.bedtime)} | ${hhmm(
        e.wake_time
      )} | ${num(e.latency_minutes)} | ${num(e.awake_minutes)} | ${
        e.exercise ?? ""
      } | ${yn(e.alcohol)} | ${num(e.stress)} | ${num(e.room_temp)} | ${num(
        e.morning_energy
      )} | ${num(e.nap_minutes)} | ${clean(e.symptoms)} | ${factors} | ${clean(
        e.notes
      )} |`
    );
  }
  return lines.join("\n");
}

export default function SleepClient({
  initialEntries,
  initialFactors,
}: {
  initialEntries: SleepEntry[];
  initialFactors: string[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [entries, setEntries] = useState(initialEntries);
  const [view, setView] = useState<"log" | "insights">("log");

  const [nightOf, setNightOf] = useState(localDateStr());
  const [bedtime, setBedtime] = useState("23:00");
  const [wake, setWake] = useState("07:00");
  const [quality, setQuality] = useState(4);
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [newFactor, setNewFactor] = useState("");
  const [saving, setSaving] = useState(false);
  const [details, setDetails] = useState<Details>(EMPTY_DETAILS);
  const [showDetails, setShowDetails] = useState(false);

  function patchDetails(p: Partial<Details>) {
    setDetails((d) => ({ ...d, ...p }));
  }

  // The user's editable factor catalog (persisted on their profile). Falls
  // back to defaults on first use.
  const [factors, setFactors] = useState<string[]>(
    initialFactors.length ? initialFactors : DEFAULT_FACTORS
  );
  const [editingFactors, setEditingFactors] = useState(false);
  const [celebrateKey, setCelebrateKey] = useState(0);

  // Confetti burst when you rate a night 5/5.
  useEffect(() => {
    if (quality === 5) setCelebrateKey((k) => k + 1);
  }, [quality]);

  const preview = computeMinutes(nightOf, bedtime, wake);

  // Persist the catalog to profiles.sleep_factors.
  async function saveFactors(next: string[]) {
    setFactors(next);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("profiles").update({ sleep_factors: next }).eq("id", user.id);
  }

  // Seed the catalog into the profile the first time (empty on a fresh user).
  useEffect(() => {
    if (initialFactors.length === 0) saveFactors(DEFAULT_FACTORS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Chips to show: the catalog, plus any tag already selected for this night
  // (so nothing selected is ever hidden).
  const allFactors = useMemo(() => {
    return Array.from(new Set<string>([...factors, ...tags]));
  }, [factors, tags]);

  // When you pick a date that's already logged, load it so re-saving edits
  // (rather than wipes) that night.
  useEffect(() => {
    const existing = entries.find((e) => e.night_of === nightOf);
    if (existing) {
      if (existing.bedtime)
        setBedtime(new Date(existing.bedtime).toTimeString().slice(0, 5));
      if (existing.wake_time)
        setWake(new Date(existing.wake_time).toTimeString().slice(0, 5));
      setQuality(existing.quality ?? 4);
      setNotes(existing.notes ?? "");
      setTags(existing.tags ?? []);
      setDetails({
        latency: existing.latency_minutes?.toString() ?? "",
        awake: existing.awake_minutes?.toString() ?? "",
        exercise: existing.exercise ?? "",
        alcohol: !!existing.alcohol,
        stress: existing.stress ?? null,
        roomTemp: existing.room_temp?.toString() ?? "",
        morning: existing.morning_energy ?? null,
        symptoms: existing.symptoms ?? "",
        nap: existing.nap_minutes?.toString() ?? "",
      });
    } else {
      setTags([]);
      setNotes("");
      setDetails(EMPTY_DETAILS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nightOf]);

  // Pull the *entire* history (not just the loaded window) for export.
  async function buildSleepExport(): Promise<string> {
    const { data } = await supabase
      .from("sleep_entries")
      .select("*")
      .order("night_of", { ascending: true });
    return formatSleepExport((data as SleepEntry[]) ?? entries);
  }

  function toggleTag(t: string) {
    setTags((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  }

  function addFactor() {
    const f = newFactor.trim();
    if (!f) return;
    // Add to the catalog (if new) and select it for tonight.
    if (!factors.some((x) => x.toLowerCase() === f.toLowerCase())) {
      saveFactors([...factors, f]);
    }
    if (!tags.includes(f)) setTags((prev) => [...prev, f]);
    setNewFactor("");
  }

  function removeFactor(f: string) {
    saveFactors(factors.filter((x) => x !== f));
    setTags((prev) => prev.filter((x) => x !== f));
  }

  async function deleteEntry(id: string) {
    const prev = entries;
    setEntries((e) => e.filter((x) => x.id !== id)); // optimistic
    const { error } = await supabase.from("sleep_entries").delete().eq("id", id);
    if (error) {
      setEntries(prev); // roll back
      alert("Could not delete: " + error.message);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const calc = computeMinutes(nightOf, bedtime, wake);
      const numOrNull = (s: string) =>
        s.trim() === "" || Number.isNaN(Number(s)) ? null : Number(s);
      const row = {
        user_id: user.id,
        night_of: nightOf,
        bedtime: calc?.bedISO ?? null,
        wake_time: calc?.wakeISO ?? null,
        duration_minutes: calc?.minutes ?? null,
        quality,
        notes: notes || null,
        tags,
        latency_minutes: numOrNull(details.latency),
        awake_minutes: numOrNull(details.awake),
        exercise: details.exercise || null,
        alcohol: details.alcohol,
        stress: details.stress,
        room_temp: numOrNull(details.roomTemp),
        morning_energy: details.morning,
        symptoms: details.symptoms || null,
        nap_minutes: numOrNull(details.nap),
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
    } catch (e) {
      alert("Could not save sleep: " + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // Nightly score for each entry (keyed by id).
  const scores = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) {
      const s = sleepScore(e, entries);
      if (s) m.set(e.id, s.score);
    }
    return m;
  }, [entries]);

  // Average score over the last N calendar days.
  function avgScoreLastDays(days: number): number | null {
    const c = new Date();
    c.setDate(c.getDate() - (days - 1));
    const cutoff = localDateStr(c);
    const ss = entries
      .filter((e) => e.night_of >= cutoff)
      .map((e) => scores.get(e.id))
      .filter((n): n is number => n != null);
    return ss.length ? Math.round(mean(ss)) : null;
  }

  // The last 7 calendar nights (most recent on the right), for the mini chart.
  const last7 = useMemo(() => {
    const arr: { ds: string; date: Date; entry: SleepEntry | null }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = localDateStr(d);
      arr.push({ ds, date: d, entry: entries.find((e) => e.night_of === ds) ?? null });
    }
    return arr;
  }, [entries]);
  return (
    <div className="px-4 pt-6">
      <h1 className="mb-4 text-3xl font-bold">Sleep</h1>

      {/* Summary: rolling average sleep score + last 7 nights */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        <ScoreTile label="7-day score" value={avgScoreLastDays(7)} />
        <ScoreTile label="14-day score" value={avgScoreLastDays(14)} />
        <ScoreTile label="30-day score" value={avgScoreLastDays(30)} />
      </div>
      <div className="mb-6 rounded-2xl bg-surface p-4">
        <div className="mb-3 text-sm text-muted">
          Last 7 nights <span className="text-muted/70">(sleep score)</span>
        </div>
        <div className="flex justify-between gap-2">
          {last7.map((d) => {
            const score = d.entry ? scores.get(d.entry.id) ?? null : null;
            const pct = score != null ? Math.max(8, score) : 0;
            return (
              <div key={d.ds} className="flex flex-1 flex-col items-center gap-1">
                <span className="h-3 text-[9px] text-muted">{score ?? ""}</span>
                <div className="flex h-24 w-full items-end justify-center">
                  <div className="flex h-full w-6 items-end rounded-md bg-surface-2">
                    {score != null && (
                      <div
                        className={`w-full rounded-md ${scoreBand(score).bg}`}
                        style={{ height: `${pct}%` }}
                        title={`Score ${score}`}
                      />
                    )}
                  </div>
                </div>
                <span className="text-[10px] text-muted">
                  {d.date.toLocaleDateString(undefined, { weekday: "narrow" })}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Segmented control */}
      <div className="mb-6 flex rounded-full bg-surface p-1">
        {(["log", "insights"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setView(t)}
            className={`flex-1 rounded-full py-2 text-sm font-medium capitalize ${
              view === t ? "bg-surface-2 text-fg" : "text-muted"
            }`}
          >
            {t === "log" ? "Log" : "Insights"}
          </button>
        ))}
      </div>

      {view === "log" ? (
        <>
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
            <div className="relative pt-1">
              <div className="flex items-center justify-between">
                <span className="text-lg">Quality</span>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((q) => (
                    <button
                      key={q}
                      onClick={() => setQuality(q)}
                      className={`h-10 w-10 rounded-full text-sm font-bold text-white transition-transform ${qualityBg(
                        q
                      )} ${
                        quality === q
                          ? "scale-110 ring-2 ring-fg"
                          : "opacity-40"
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-1 flex justify-end">
                <span className={`text-sm font-semibold ${QUALITY_META[quality].text}`}>
                  {QUALITY_META[quality].emoji} {QUALITY_META[quality].label}
                </span>
              </div>
              {quality === 5 && <Confetti key={celebrateKey} />}
            </div>

            {/* More details (collapsible) — feeds the sleep score */}
            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              className="text-sm font-medium text-accent"
            >
              {showDetails ? "− Less detail" : "+ More detail"}
            </button>
            {showDetails && (
              <div className="space-y-3 border-t border-hair pt-3">
                <Between label="Symptoms">
                  <select
                    value={details.symptoms}
                    onChange={(e) => patchDetails({ symptoms: e.target.value })}
                    className="rounded-xl bg-surface-2 px-3 py-2 text-sm outline-none"
                  >
                    {SYMPTOM_OPTS.map((o) => (
                      <option key={o.v} value={o.v}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Between>
                <Row label="Fell asleep in (min)">
                  <NumField
                    value={details.latency}
                    onChange={(v) => patchDetails({ latency: v })}
                  />
                </Row>
                <Row label="Awake overnight (min)">
                  <NumField
                    value={details.awake}
                    onChange={(v) => patchDetails({ awake: v })}
                  />
                </Row>
                <div>
                  <div className="mb-1 text-sm text-muted">Exercise today</div>
                  <div className="flex flex-wrap gap-2">
                    {EXERCISE_OPTS.map((opt) => (
                      <button
                        key={opt}
                        onClick={() =>
                          patchDetails({
                            exercise: details.exercise === opt ? "" : opt,
                          })
                        }
                        className={`rounded-full px-3 py-1.5 text-sm font-medium capitalize ${
                          details.exercise === opt
                            ? "bg-gold text-black"
                            : "bg-surface-2 text-muted"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
                <Row label="Alcohol">
                  <YesNo
                    value={details.alcohol}
                    onChange={(v) => patchDetails({ alcohol: v })}
                  />
                </Row>
                <Between label="Stress">
                  <Scale5
                    value={details.stress}
                    onChange={(v) => patchDetails({ stress: v })}
                  />
                </Between>
                <Between label="Morning energy & mood">
                  <Scale5
                    value={details.morning}
                    onChange={(v) => patchDetails({ morning: v })}
                  />
                </Between>
                <div>
                  <div className="mb-1 text-sm text-muted">Room temp</div>
                  <div className="flex flex-wrap gap-2">
                    {ROOM_TEMP_OPTS.map((o) => (
                      <button
                        key={o.v}
                        onClick={() =>
                          patchDetails({
                            roomTemp: details.roomTemp === o.v ? "" : o.v,
                          })
                        }
                        className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                          details.roomTemp === o.v
                            ? "bg-gold text-black"
                            : "bg-surface-2 text-muted"
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
                <Row label="Nap (min)">
                  <NumField
                    value={details.nap}
                    onChange={(v) => patchDetails({ nap: v })}
                  />
                </Row>
              </div>
            )}

            {/* Factors */}
            <div className="pt-1">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm text-muted">
                  Factors (what you did that night)
                </span>
                <button
                  onClick={() => setEditingFactors((v) => !v)}
                  className="text-sm font-medium text-gold"
                >
                  {editingFactors ? "Done" : "Edit"}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {allFactors.map((f) => {
                  const selected = tags.includes(f);
                  return (
                    <span
                      key={f}
                      className={`inline-flex items-center rounded-full text-sm font-medium ${
                        selected ? "bg-gold text-black" : "bg-surface-2 text-muted"
                      }`}
                    >
                      <button
                        onClick={() => toggleTag(f)}
                        className={`py-1.5 pl-3 ${editingFactors ? "pr-1.5" : "pr-3"}`}
                      >
                        {f}
                      </button>
                      {editingFactors && (
                        <button
                          onClick={() => removeFactor(f)}
                          aria-label={`Remove ${f}`}
                          className={`py-1.5 pl-0.5 pr-2.5 ${
                            selected ? "text-black/60" : "text-muted"
                          }`}
                        >
                          ✕
                        </button>
                      )}
                    </span>
                  );
                })}
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  value={newFactor}
                  onChange={(e) => setNewFactor(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addFactor()}
                  placeholder="Add a factor…"
                  className="min-w-0 flex-1 rounded-xl bg-surface-2 px-3 py-2 text-sm outline-none placeholder:text-muted"
                />
                <button
                  onClick={addFactor}
                  className="rounded-xl bg-surface-2 px-4 text-sm font-medium text-gold"
                >
                  Add
                </button>
              </div>
            </div>

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Notes (dreams, wake-ups…)"
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
              <SwipeRow
                key={e.id}
                onDelete={() => deleteEntry(e.id)}
                onTap={() => {
                  setNightOf(e.night_of);
                  setView("log");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                <div className="flex w-full items-start justify-between bg-surface px-4 py-3 text-left">
                <div className="min-w-0">
                  <div className="font-medium">
                    {new Date(e.night_of + "T00:00:00").toLocaleDateString(
                      undefined,
                      { weekday: "short", month: "short", day: "numeric" }
                    )}
                  </div>
                  {(e.tags ?? []).length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(e.tags ?? []).map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  {e.notes && (
                    <div className="mt-1 whitespace-pre-wrap break-words text-sm text-muted">
                      {e.notes}
                    </div>
                  )}
                </div>
                <div className="ml-3 flex shrink-0 items-center gap-3 text-right">
                  <div>
                    <div className="text-lg text-gold">
                      {fmtDuration(e.duration_minutes)}
                    </div>
                    <div
                      className={`text-sm ${
                        e.quality ? QUALITY_META[e.quality].text : "text-muted"
                      }`}
                    >
                      {e.quality ? "★".repeat(e.quality) : ""}
                    </div>
                  </div>
                  {scores.get(e.id) != null && (
                    <ScoreBadge score={scores.get(e.id) as number} />
                  )}
                </div>
                </div>
              </SwipeRow>
            ))}
          </div>
        </>
      ) : (
        <Insights entries={entries} />
      )}

      {/* Export for AI analysis — at the bottom of the screen */}
      <div className="mt-8 flex justify-center">
        <CopyButton getText={buildSleepExport} label="Copy log for AI" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Insights: for each factor, average sleep on nights WITH it vs WITHOUT it.
// ---------------------------------------------------------------------------
function Insights({ entries }: { entries: SleepEntry[] }) {
  const withDur = entries.filter(
    (e): e is SleepEntry & { duration_minutes: number } =>
      e.duration_minutes != null
  );

  const overall = useMemo(() => {
    if (withDur.length === 0) return null;
    const durs = withDur.map((e) => e.duration_minutes);
    const quals = withDur.map((e) => e.quality).filter((q): q is number => q != null);
    return {
      avg: mean(durs),
      best: Math.max(...durs),
      worst: Math.min(...durs),
      avgQ: quals.length ? mean(quals) : null,
      n: withDur.length,
    };
  }, [withDur]);

  const insights = useMemo(() => {
    const factors = new Set<string>();
    for (const e of withDur) for (const t of e.tags ?? []) factors.add(t);

    const rows = Array.from(factors).map((factor) => {
      const on = withDur.filter((e) => (e.tags ?? []).includes(factor));
      const off = withDur.filter((e) => !(e.tags ?? []).includes(factor));
      const withAvg = mean(on.map((e) => e.duration_minutes));
      const withoutAvg = off.length ? mean(off.map((e) => e.duration_minutes)) : null;
      const onQ = on.map((e) => e.quality).filter((q): q is number => q != null);
      const offQ = off.map((e) => e.quality).filter((q): q is number => q != null);
      return {
        factor,
        withAvg,
        withoutAvg,
        delta: withoutAvg != null ? withAvg - withoutAvg : null,
        withN: on.length,
        withoutN: off.length,
        withQ: onQ.length ? mean(onQ) : null,
        withoutQ: offQ.length ? mean(offQ) : null,
      };
    });

    // Rank by biggest positive impact; unknown baselines sink to the bottom.
    return rows.sort(
      (a, b) => (b.delta ?? -Infinity) - (a.delta ?? -Infinity)
    );
  }, [withDur]);

  const maxAbs = Math.max(
    1,
    ...insights.map((i) => (i.delta != null ? Math.abs(i.delta) : 0))
  );

  if (!overall) {
    return (
      <p className="text-muted">
        Log a few nights with factors and your insights will appear here.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall */}
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Avg" value={fmtHours(overall.avg)} />
        <Stat label="Best" value={fmtHours(overall.best)} />
        <Stat label="Worst" value={fmtHours(overall.worst)} />
      </div>

      <div>
        <h2 className="mb-1 text-lg font-semibold">What&apos;s working</h2>
        <p className="mb-3 text-sm text-muted">
          Average sleep on nights with each factor vs without it.
        </p>

        {insights.length === 0 ? (
          <p className="text-muted">
            No factors tagged yet. Add factors like &ldquo;Sleep tea&rdquo; when
            you log a night.
          </p>
        ) : (
          <div className="space-y-3">
            {insights.map((i) => (
              <div key={i.factor} className="rounded-2xl bg-surface p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium">{i.factor}</span>
                  {i.delta != null ? (
                    <span
                      className={`text-sm font-semibold ${
                        i.delta >= 0 ? "text-emerald-500" : "text-accent"
                      }`}
                    >
                      {i.delta >= 0 ? "+" : "−"}
                      {fmtHours(Math.abs(i.delta))}
                    </span>
                  ) : (
                    <span className="text-sm text-muted">no baseline yet</span>
                  )}
                </div>

                {/* Diverging impact bar */}
                {i.delta != null && (
                  <div className="relative mb-2 h-2 rounded-full bg-surface-2">
                    <div className="absolute left-1/2 top-0 h-full w-px bg-hair" />
                    <div
                      className={`absolute top-0 h-full rounded-full ${
                        i.delta >= 0 ? "bg-emerald-500" : "bg-accent"
                      }`}
                      style={{
                        left: i.delta >= 0 ? "50%" : undefined,
                        right: i.delta < 0 ? "50%" : undefined,
                        width: `${(Math.abs(i.delta) / maxAbs) * 50}%`,
                      }}
                    />
                  </div>
                )}

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                  <span>
                    <span className="text-gold">{fmtHours(i.withAvg)}</span> with
                    ({i.withN})
                  </span>
                  {i.withoutAvg != null && (
                    <span>
                      {fmtHours(i.withoutAvg)} without ({i.withoutN})
                    </span>
                  )}
                  {i.withQ != null && (
                    <span>
                      quality {i.withQ.toFixed(1)}
                      {i.withoutQ != null ? ` vs ${i.withoutQ.toFixed(1)}` : ""}
                    </span>
                  )}
                </div>
                {i.withN < 3 && (
                  <div className="mt-1 text-xs text-muted">
                    Limited data — keep logging for a clearer signal.
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface p-3 text-center">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-lg font-semibold text-gold">{value}</div>
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
