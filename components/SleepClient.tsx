"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { SleepEntry } from "@/lib/types";
import { localDateStr } from "@/lib/logic";
import CopyButton from "./CopyButton";

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
  lines.push("");
  lines.push("| Date | Duration | Quality | Bedtime | Wake | Factors | Notes |");
  lines.push("|---|---|---|---|---|---|---|");
  for (const e of sorted) {
    const dur = e.duration_minutes != null ? fmtDuration(e.duration_minutes) : "";
    const q = e.quality != null ? `${e.quality}/5` : "";
    const factors = (e.tags ?? []).join(", ");
    const notes = (e.notes ?? "").replace(/\r?\n/g, " ").replace(/\|/g, "/");
    lines.push(
      `| ${e.night_of} | ${dur} | ${q} | ${hhmm(e.bedtime)} | ${hhmm(
        e.wake_time
      )} | ${factors} | ${notes} |`
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

  // The user's editable factor catalog (persisted on their profile). Falls
  // back to defaults on first use.
  const [factors, setFactors] = useState<string[]>(
    initialFactors.length ? initialFactors : DEFAULT_FACTORS
  );
  const [editingFactors, setEditingFactors] = useState(false);

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
    } else {
      setTags([]);
      setNotes("");
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
        tags,
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

  const avg7 = useMemo(() => {
    const recent = entries
      .slice(0, 7)
      .map((e) => e.duration_minutes)
      .filter((m): m is number => m != null);
    if (recent.length === 0) return null;
    return Math.round(mean(recent));
  }, [entries]);

  return (
    <div className="px-4 pt-6">
      <div className="mb-5 flex items-baseline justify-between">
        <h1 className="text-3xl font-bold">Sleep</h1>
        {avg7 != null && (
          <span className="text-muted">7-day avg {fmtDuration(avg7)}</span>
        )}
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

      {/* Export for AI analysis */}
      <div className="mb-4 flex justify-end">
        <CopyButton getText={buildSleepExport} label="Copy log for AI" />
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
              <button
                key={e.id}
                onClick={() => {
                  setNightOf(e.night_of);
                  setView("log");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="flex w-full items-start justify-between rounded-xl bg-surface px-4 py-3 text-left"
              >
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
                    <div className="mt-1 max-w-[16rem] truncate text-sm text-muted">
                      {e.notes}
                    </div>
                  )}
                </div>
                <div className="ml-3 shrink-0 text-right">
                  <div className="text-lg text-gold">
                    {fmtDuration(e.duration_minutes)}
                  </div>
                  <div className="text-sm text-muted">
                    {e.quality ? "★".repeat(e.quality) : ""}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      ) : (
        <Insights entries={entries} />
      )}
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
