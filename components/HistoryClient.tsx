"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatWeight } from "@/lib/logic";
import { APP_VERSION } from "@/lib/version";
import ThemeToggle from "./ThemeToggle";
import CopyButton from "./CopyButton";
import SwipeRow from "./SwipeRow";

export type SessionSummary = {
  id: string;
  performed_at: string;
  template_name: string | null;
  body_weight: number | null;
  notes: string | null;
  duration_seconds: number | null;
  exercises: { name: string; weight: number; sets: number; reps: number }[];
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DOW = ["S", "M", "T", "W", "T", "F", "S"];

export default function HistoryClient({
  sessions: initialSessions,
}: {
  sessions: SessionSummary[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [tab, setTab] = useState<"calendar" | "list">("calendar");
  const [sessions, setSessions] = useState(initialSessions);
  const trainedDays = useMemo(
    () => new Set(sessions.map((s) => s.performed_at)),
    [sessions]
  );

  async function deleteSession(id: string) {
    const prev = sessions;
    setSessions((s) => s.filter((x) => x.id !== id)); // optimistic
    const { error } = await supabase
      .from("workout_sessions")
      .delete()
      .eq("id", id);
    if (error) {
      setSessions(prev); // roll back
      alert("Could not delete: " + error.message);
    }
  }

  return (
    <div className="px-4 pt-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">History</h1>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <SignOut />
        </div>
      </div>

      {/* Segmented control */}
      <div className="mb-4 flex rounded-full bg-surface p-1">
        {(["calendar", "list"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-full py-2 text-sm font-medium capitalize ${
              tab === t ? "bg-surface-2 text-fg" : "text-muted"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Export for AI analysis */}
      <div className="mb-5 flex justify-end">
        <CopyButton
          getText={() => formatWorkoutExport(sessions)}
          label="Copy log for AI"
        />
      </div>

      {tab === "calendar" ? (
        <Calendars trainedDays={trainedDays} />
      ) : (
        <SessionList sessions={sessions} onDelete={deleteSession} />
      )}

      <p className="mt-10 pb-2 text-center text-xs text-muted">
        Health v{APP_VERSION}
      </p>
    </div>
  );
}

// Markdown table of the workout log, ready to paste into an AI chat.
function formatWorkoutExport(sessions: SessionSummary[]): string {
  const sorted = [...sessions].sort((a, b) =>
    a.performed_at < b.performed_at ? -1 : 1
  );
  const lines: string[] = [];
  lines.push(`# Workout log (exported ${new Date().toISOString().slice(0, 10)})`);
  lines.push(`Sessions: ${sorted.length}`);
  lines.push("");
  lines.push("| Date | Workout | Exercises | Body weight | Notes |");
  lines.push("|---|---|---|---|---|");
  for (const s of sorted) {
    const ex = s.exercises
      .map((e) => `${e.name} ${e.sets}×${e.reps} ${formatWeight(e.weight)}`)
      .join("; ");
    const bw = s.body_weight != null ? formatWeight(s.body_weight) : "";
    const notes = (s.notes ?? "").replace(/\r?\n/g, " ").replace(/\|/g, "/");
    lines.push(
      `| ${s.performed_at} | ${s.template_name ?? ""} | ${ex} | ${bw} | ${notes} |`
    );
  }
  return lines.join("\n");
}

function Calendars({ trainedDays }: { trainedDays: Set<string> }) {
  // Show the current month and the previous two.
  const now = new Date();
  const months = [0, 1, 2].map(
    (back) => new Date(now.getFullYear(), now.getMonth() - back, 1)
  );

  return (
    <div className="space-y-8">
      {months.map((m) => (
        <MonthGrid key={`${m.getFullYear()}-${m.getMonth()}`} month={m} trainedDays={trainedDays} />
      ))}
    </div>
  );
}

function MonthGrid({
  month,
  trainedDays,
}: {
  month: Date;
  trainedDays: Set<string>;
}) {
  const year = month.getFullYear();
  const mon = month.getMonth();
  const firstDow = new Date(year, mon, 1).getDay();
  const daysInMonth = new Date(year, mon + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div>
      <div className="mb-3 text-center text-lg font-semibold">
        {MONTHS[mon]} {year}
      </div>
      <div className="grid grid-cols-7 gap-y-2 text-center">
        {DOW.map((d, i) => (
          <div key={i} className="text-xs text-muted">
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />;
          const ds = `${year}-${String(mon + 1).padStart(2, "0")}-${String(
            day
          ).padStart(2, "0")}`;
          const trained = trainedDays.has(ds);
          return (
            <div key={i} className="flex justify-center">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm ${
                  trained ? "bg-accent font-semibold text-white" : "text-fg/90"
                }`}
              >
                {day}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SessionList({
  sessions,
  onDelete,
}: {
  sessions: SessionSummary[];
  onDelete: (id: string) => void;
}) {
  if (sessions.length === 0) {
    return <p className="text-muted">No workouts logged yet.</p>;
  }
  return (
    <div className="space-y-3">
      {sessions.map((s) => (
        <SwipeRow key={s.id} onDelete={() => onDelete(s.id)}>
        <div className="bg-surface p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="font-semibold">
              {new Date(s.performed_at + "T00:00:00").toLocaleDateString(
                undefined,
                { weekday: "short", month: "short", day: "numeric", year: "numeric" }
              )}
              {s.template_name && (
                <span className="ml-2 rounded-md bg-surface-2 px-2 py-0.5 text-xs text-muted">
                  Workout {s.template_name}
                </span>
              )}
            </div>
            {s.duration_seconds != null && (
              <span className="text-sm text-muted">
                {Math.round(s.duration_seconds / 60)} min
              </span>
            )}
          </div>
          <div className="space-y-1">
            {s.exercises.map((e, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-fg/90">{e.name}</span>
                <span className="text-muted">
                  {e.sets}×{e.reps} {formatWeight(e.weight)}
                </span>
              </div>
            ))}
          </div>
          {(s.body_weight || s.notes) && (
            <div className="mt-2 border-t border-hair pt-2 text-sm text-muted">
              {s.body_weight ? `BW ${formatWeight(s.body_weight)}` : ""}
              {s.body_weight && s.notes ? " · " : ""}
              {s.notes ?? ""}
            </div>
          )}
        </div>
        </SwipeRow>
      ))}
    </div>
  );
}

function SignOut() {
  const supabase = createClient();
  return (
    <button
      onClick={async () => {
        await supabase.auth.signOut();
        window.location.href = "/login";
      }}
      className="text-sm text-muted"
    >
      Sign out
    </button>
  );
}
