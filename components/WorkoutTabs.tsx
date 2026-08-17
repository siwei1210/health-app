"use client";

import { useState } from "react";
import WorkoutClient, { type TemplateWithExercises } from "./WorkoutClient";
import ActivityLogger from "./ActivityLogger";
import type { Activity } from "@/lib/types";

// The Workout tab hosts two modes: the barbell 5x5 session (Strength) and the
// general Activity log (row, dead hang, walking, etc.).
export default function WorkoutTabs({
  templates,
  startIndex,
  unit,
  initialActivities,
}: {
  templates: TemplateWithExercises[];
  startIndex: number;
  unit: string;
  initialActivities: Activity[];
}) {
  const [mode, setMode] = useState<"strength" | "activity">("strength");

  return (
    <div>
      <div className="px-4 pt-6">
        <div className="flex rounded-full bg-surface p-1">
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
      </div>
      {mode === "strength" ? (
        <WorkoutClient
          templates={templates}
          startIndex={startIndex}
          unit={unit}
        />
      ) : (
        <ActivityLogger initialActivities={initialActivities} />
      )}
    </div>
  );
}
