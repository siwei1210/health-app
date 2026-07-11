"use client";

import { useEffect, useRef, useState } from "react";

// Rest zones with thresholds (seconds). Colors escalate so a glance tells you
// how long you've been resting; crossings at 1:30 / 3:00 / 5:00 fire an alert.
const ZONES = [
  { at: 0, label: "resting", bg: "bg-surface-2", text: "text-fg" },
  { at: 90, label: "good to go", bg: "bg-emerald-500", text: "text-white" },
  { at: 180, label: "getting long", bg: "bg-amber-500", text: "text-black" },
  { at: 300, label: "go now!", bg: "bg-red-600", text: "text-white" },
];

function zoneIndex(s: number): number {
  let idx = 0;
  for (let i = 0; i < ZONES.length; i++) if (s >= ZONES[i].at) idx = i;
  return idx;
}

// Counts up from 0 whenever it (re)mounts. WorkoutClient bumps its `key`
// on each logged set so rest restarts, StrongLifts-style.
export default function RestTimer({
  running,
  initialSeconds = 0,
}: {
  running: boolean;
  initialSeconds?: number;
}) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [flash, setFlash] = useState(false);
  const lastZone = useRef(0);
  const audioRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  // Fire an alert when we cross into a higher zone.
  useEffect(() => {
    const z = zoneIndex(seconds);
    if (z > lastZone.current) {
      lastZone.current = z;
      alertUser(z);
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 1200);
      return () => clearTimeout(t);
    }
  }, [seconds]);

  function alertUser(z: number) {
    // Haptics (Android; iOS Safari ignores this).
    try {
      navigator.vibrate?.(
        z === 1 ? [180] : z === 2 ? [200, 120, 200] : [260, 120, 260, 120, 260]
      );
    } catch {}
    // Best-effort beep (z beeps). iOS may block if the tab is muted.
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = audioRef.current ?? new Ctx();
      audioRef.current = ctx;
      if (ctx.state === "suspended") ctx.resume();
      for (let i = 0; i < z; i++) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.frequency.value = 880;
        const t = ctx.currentTime + i * 0.28;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        o.start(t);
        o.stop(t + 0.24);
      }
    } catch {}
  }

  const idx = zoneIndex(seconds);
  const z = ZONES[idx];
  const mm = Math.floor(seconds / 60);
  const ss = String(seconds % 60).padStart(2, "0");
  const pulsing = running && (idx >= 3 || flash);

  return (
    <div
      className={`flex items-center justify-center gap-2 rounded-2xl py-3 transition-colors ${
        running ? `${z.bg} ${z.text}` : "bg-surface text-muted"
      } ${pulsing ? "animate-pulse" : ""}`}
    >
      <ClockIcon />
      <span className="tabular-nums text-lg font-semibold">
        {running ? `Rest ${mm}:${ss}` : "Rest timer"}
        {running && idx >= 1 ? ` · ${z.label}` : ""}
      </span>
    </div>
  );
}

function ClockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
