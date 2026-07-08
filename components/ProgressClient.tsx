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

export type ExercisePoint = {
  date: string;
  weight: number;
  volume: number;
  e1rm: number;
  reps: number;
};

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

export default function ProgressClient({
  data,
}: {
  data: Record<string, ExercisePoint[]>;
}) {
  const names = Object.keys(data);
  const [exercise, setExercise] = useState(names[0] ?? "");
  const [metric, setMetric] = useState<Metric>("weight");
  const [range, setRange] = useState<Range>("ALL");

  const points = useMemo(() => {
    const all = data[exercise] ?? [];
    const days = RANGE_DAYS[range];
    if (days === Infinity) return all;
    const cutoff = Date.now() - days * 24 * 3600 * 1000;
    return all.filter((p) => new Date(p.date + "T00:00:00").getTime() >= cutoff);
  }, [data, exercise, range]);

  const metricInfo = METRICS.find((m) => m.key === metric)!;
  const latest = points.length ? points[points.length - 1] : null;

  if (names.length === 0) {
    return (
      <div className="px-4 pt-6">
        <h1 className="mb-6 text-3xl font-bold">Progress</h1>
        <p className="text-muted">
          No workout data yet. Finish a workout and your charts will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6">
      <h1 className="mb-4 text-3xl font-bold">Progress</h1>

      {/* Exercise selector */}
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

      {/* Latest value */}
      <div className="mb-1 text-3xl font-bold" style={{ color: metricInfo.color }}>
        {latest ? formatMetric(latest[metric], metric) : "—"}
      </div>
      <div className="mb-4 text-sm text-muted">
        {latest
          ? new Date(latest.date + "T00:00:00").toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : "No data in range"}
      </div>

      {/* Chart */}
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
                background: "#1c1c1e",
                border: "1px solid #38383a",
                borderRadius: 12,
                color: "#fff",
              }}
              labelFormatter={(d) =>
                new Date(d + "T00:00:00").toLocaleDateString()
              }
              formatter={(v: number) => [formatMetric(v, metric), metricInfo.label]}
            />
            <Line
              type="monotone"
              dataKey={metric}
              stroke={metricInfo.color}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Range selector */}
      <div className="mt-3 flex rounded-full bg-surface p-1">
        {RANGES.map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`flex-1 rounded-full py-2 text-sm font-medium ${
              range === r ? "bg-surface-2 text-white" : "text-muted"
            }`}
          >
            {r === "ALL" ? "∞" : r}
          </button>
        ))}
      </div>

      {/* Metric selector */}
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
    </div>
  );
}

function formatMetric(v: number, metric: Metric): string {
  if (metric === "reps") return `${v} reps`;
  if (metric === "volume") return `${v.toLocaleString()} lb`;
  return `${Number.isInteger(v) ? v : v.toFixed(1)}lb`;
}
