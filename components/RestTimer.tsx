"use client";

import { useEffect, useState } from "react";

// Counts up from 0 whenever it (re)mounts. WorkoutClient bumps its `key`
// on each logged set so rest restarts, StrongLifts-style.
export default function RestTimer({ running }: { running: boolean }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const mm = Math.floor(seconds / 60);
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="flex items-center justify-center gap-2 rounded-2xl bg-surface py-3">
      <ClockIcon />
      <span className="tabular-nums text-lg">
        {running ? `Rest ${mm}:${ss}` : "Rest timer"}
      </span>
    </div>
  );
}

function ClockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="#8e8e93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
