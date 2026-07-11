"use client";

import { useState } from "react";

// Copies text (possibly fetched on demand) to the clipboard with feedback.
// Falls back to a hidden textarea for older iOS Safari.
export default function CopyButton({
  getText,
  label = "Copy",
  className,
}: {
  getText: () => string | Promise<string>;
  label?: string;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "working" | "done">("idle");

  async function copy() {
    setState("working");
    try {
      const text = await getText();
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setState("done");
      setTimeout(() => setState("idle"), 1600);
    } catch (e) {
      setState("idle");
      alert("Could not copy: " + (e as Error).message);
    }
  }

  return (
    <button
      onClick={copy}
      disabled={state === "working"}
      className={
        className ??
        "inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-sm font-medium text-gold disabled:opacity-60"
      }
    >
      {state === "done" ? (
        "Copied!"
      ) : state === "working" ? (
        "Copying…"
      ) : (
        <>
          <CopyIcon />
          {label}
        </>
      )}
    </button>
  );
}

function CopyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}
