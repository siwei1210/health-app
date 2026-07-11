"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatWeight } from "@/lib/logic";
import ThemeToggle from "./ThemeToggle";

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
  sessions,
}: {
  sessions: SessionSummary[];
}) {
  const [tab, setTab] = useState<"calendar" | "list">("calendar");
  const trainedDays = useMemo(
    () => new Set(sessions.map((s) => s.performed_at)),
    [sessions]
  );

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
      <div className="mb-6 flex rounded-full bg-surface p-1">
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

      {tab === "calendar" ? (
        <Calendars trainedDays={trainedDays} />
      ) : (
        <SessionList sessions={sessions} />
      )}
    </div>
  );
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

function SessionList({ sessions }: { sessions: SessionSummary[] }) {
  if (sessions.length === 0) {
    return <p className="text-muted">No workouts logged yet.</p>;
  }
  return (
    <div className="space-y-3">
      {sessions.map((s) => (
        <div key={s.id} className="rounded-2xl bg-surface p-4">
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
