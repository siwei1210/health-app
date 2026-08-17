"use client";

import { useMemo, useState } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { activityType } from "@/lib/activities";

export type ExercisePoint = {
  date: string;
  weight: number;
  volume: number;
  e1rm: number;
  reps: number;
};

export type ActivityPoint = { date: string; value: number };

type Metric = "weight" | "e1rm" | "volume" | "reps";
type Range = "1M" | "3M" | "6M" | "1Y" | "2Y" | "ALL";

const METRICS: { key: Metric; label: string; color: string }[] = [
  { key: "weight", label: "Weight", color: "#ffb02e" },
  { key: "e1rm", label: "e1RM", color: "#ff3b30" },
  { key: "volume", label: "Volume", color: "#34c759" },
  { key: "reps", label: "Reps", color: "#0a84ff" },
];

const RANGES: Range[] = ["1M", "3M", "6M", "1Y", "2Y", "ALL"];
const RANGE_DAYS: Record<Range, number> = {
  "1M": 30, "3M": 90, "6M": 180, "1Y": 365, "2Y": 730, ALL: Infinity,
};

function withinRange<T extends { date: string }>(all: T[], range: Range): T[] {
  const days = RANGE_DAYS[range];
  if (days === Infinity) return all;
  const cutoff = Date.now() - days * 24 * 3600 * 1000;
  return all.filter((p) => new Date(p.date + "T00:00:00").getTime() >= cutoff);
}

const ACTIVITY_COLOR = "#ffb02e";

export default function ProgressClient({
  data,
  activityData = {},
}: {
  data: Record<string, ExercisePoint[]>;
  activityData?: Record<string, ActivityPoint[]>;
}) {
  const names = Object.keys(data);
  const activityTypes = Object.keys(activityData);

  const [mode, setMode] = useState<"strength" | "activity">("strength");
  const [range, setRange] = useState<Range>("ALL");

  if (names.length === 0 && activityTypes.length === 0) {
    return (
      <div className="px-4 pt-6">
        <h1 className="mb-6 text-3xl font-bold">Progress</h1>
        <p className="text-muted">
          No data yet. Finish a workout or log an activity and your charts will
          appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6">
      <h1 className="mb-4 text-3xl font-bold">Progress</h1>

      {/* Strength / Activity toggle */}
      <div className="mb-4 flex rounded-full bg-surface p-1">
        {(["strength", "activity"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 rounded-full py-2 text-sm font-medium ${
              mode === m ? "bg-surface-2 text-fg" : "text-muted"
            }`}
          >
            {m === "strength" ? "Strength" : "Activity"}
          </button>
        ))}
      </div>

      {mode === "strength" ? (
        <StrengthProgress data={data} range={range} setRange={setRange} />
      ) : (
        <ActivityProgress
          data={activityData}
          range={range}
          setRange={setRange}
        />
      )}
    </div>
  );
}

function RangeSelector({
  range,
  setRange,
}: {
  range: Range;
  setRange: (r: Range) => void;
}) {
  return (
    <div className="mt-3 flex rounded-full bg-surface p-1">
      {RANGES.map((r) => (
        <button
          key={r}
          onClick={() => setRange(r)}
          className={`flex-1 rounded-full py-2 text-sm font-medium ${
            range === r ? "bg-surface-2 text-fg" : "text-muted"
          }`}
        >
          {r === "ALL" ? "∞" : r}
        </button>
      ))}
    </div>
  );
}

function Chart({
  points,
  color,
  format,
  label,
}: {
  points: { date: string; [k: string]: number | string }[];
  color: string;
  format: (v: number) => string;
  label: string;
}) {
  return (
    <div className="h-64 w-full rounded-2xl bg-surface p-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
          <XAxis
            dataKey="date"
            tick={{ fill: "#8e8e93", fontSize: 11 }}
            tickFormatter={(d: string) =>
              new Date(d + "T00:00:00").toLocaleDateString(undefined, {
                month: "short",
                year: "2-digit",
              })
            }
            minTickGap={40}
          />
          <YAxis
            tick={{ fill: "#8e8e93", fontSize: 11 }}
            domain={["auto", "auto"]}
            width={44}
          />
          <Tooltip
            contentStyle={{
              background: "rgb(var(--surface))",
              border: "1px solid rgb(var(--hair))",
              borderRadius: 12,
              color: "rgb(var(--fg))",
            }}
            labelFormatter={(d) => new Date(d + "T00:00:00").toLocaleDateString()}
            formatter={(v: number) => [format(v), label]}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function StrengthProgress({
  data,
  range,
  setRange,
}: {
  data: Record<string, ExercisePoint[]>;
  range: Range;
  setRange: (r: Range) => void;
}) {
  const names = Object.keys(data);
  const [exercise, setExercise] = useState(names[0] ?? "");
  const [metric, setMetric] = useState<Metric>("weight");

  const points = useMemo(
    () =>
      withinRange(data[exercise] ?? [], range).map((p) => ({
        date: p.date,
        value: p[metric],
      })),
    [data, exercise, range, metric]
  );

  const info = METRICS.find((m) => m.key === metric)!;
  const latest = points.length ? points[points.length - 1] : null;

  if (names.length === 0) {
    return <p className="text-muted">No strength data yet.</p>;
  }

  return (
    <>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {names.map((n) => (
          <button
            key={n}
            onClick={() => setExercise(n)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium ${
              n === exercise ? "bg-accent text-white" : "bg-surface text-muted"
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      <div className="mb-1 text-3xl font-bold" style={{ color: info.color }}>
        {latest ? formatMetric(latest.value, metric) : "—"}
      </div>
      <div className="mb-4 text-sm text-muted">
        {latest ? dateLabel(latest.date) : "No data in range"}
      </div>

      <Chart
        points={points}
        color={info.color}
        format={(v) => formatMetric(v, metric)}
        label={info.label}
      />
      <RangeSelector range={range} setRange={setRange} />

      <div className="mt-3 grid grid-cols-4 gap-2">
        {METRICS.map((m) => (
          <button
            key={m.key}
            onClick={() => setMetric(m.key)}
            className={`rounded-xl py-2 text-sm font-medium ${
              metric === m.key ? "bg-surface-2" : "bg-surface text-muted"
            }`}
            style={metric === m.key ? { color: m.color } : {}}
          >
            {m.label}
          </button>
        ))}
      </div>
    </>
  );
}

function ActivityProgress({
  data,
  range,
  setRange,
}: {
  data: Record<string, ActivityPoint[]>;
  range: Range;
  setRange: (r: Range) => void;
}) {
  const types = Object.keys(data);
  const [type, setType] = useState(types[0] ?? "");

  const points = useMemo(
    () => withinRange(data[type] ?? [], range),
    [data, type, range]
  );

  if (types.length === 0) {
    return (
      <p className="text-muted">
        No activity data yet. Log a Row, Dead hang, or Walk and it&apos;ll chart
        here.
      </p>
    );
  }

  const def = activityType(type);
  const fmt = (v: number) => formatActivityValue(v, def.metric);
  const label = def.metric === "hold" ? "Hold" : "Minutes";
  const latest = points.length ? points[points.length - 1] : null;

  return (
    <>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {types.map((t) => {
          const d = activityType(t);
          return (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium ${
                t === type ? "bg-accent text-white" : "bg-surface text-muted"
              }`}
            >
              <span>{d.emoji}</span>
              {d.label}
            </button>
          );
        })}
      </div>

      <div
        className="mb-1 text-3xl font-bold"
        style={{ color: ACTIVITY_COLOR }}
      >
        {latest ? fmt(latest.value) : "—"}
      </div>
      <div className="mb-4 text-sm text-muted">
        {latest ? dateLabel(latest.date) : "No data in range"}
      </div>

      <Chart points={points} color={ACTIVITY_COLOR} format={fmt} label={label} />
      <RangeSelector range={range} setRange={setRange} />
    </>
  );
}

function dateLabel(date: string): string {
  return new Date(date + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatMetric(v: number, metric: Metric): string {
  if (metric === "reps") return `${v} reps`;
  if (metric === "volume") return `${v.toLocaleString()} lb`;
  return `${Number.isInteger(v) ? v : v.toFixed(1)}lb`;
}

function formatActivityValue(v: number, metric: "duration" | "hold"): string {
  if (metric === "hold") {
    return v >= 60 ? `${Math.floor(v / 60)}m ${v % 60}s` : `${v}s`;
  }
  return `${v} min`;
}
