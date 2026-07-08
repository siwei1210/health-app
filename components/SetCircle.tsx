"use client";

// A single tappable set. Tapping cycles reps: empty → target → … → 0 → empty.
export default function SetCircle({
  reps,
  target,
  active,
  onClick,
}: {
  reps: number | null;
  target: number;
  active: boolean;
  onClick: () => void;
}) {
  const success = reps !== null && reps >= target;
  const partial = reps !== null && reps > 0 && reps < target;
  const fail = reps === 0;

  let cls = "bg-surface-2 text-muted";
  if (success) cls = "bg-accent text-white";
  else if (partial) cls = "bg-gold text-black";
  else if (fail) cls = "bg-surface-2 text-accent ring-2 ring-accent";

  return (
    <button
      onClick={onClick}
      className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-semibold transition-colors ${cls} ${
        active && reps === null ? "ring-2 ring-accent/60" : ""
      }`}
    >
      {reps === null ? target : reps === 0 ? "✕" : reps}
    </button>
  );
}
