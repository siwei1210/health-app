"use client";

import { useRef, useState } from "react";

// iOS-style swipe-left row: partial swipe reveals a red Delete button; a full
// swipe deletes immediately. Vertical drags still scroll the page (touch-action
// pan-y). onTap fires for a plain tap when nothing is revealed.
export default function SwipeRow({
  children,
  onDelete,
  onTap,
  className = "",
}: {
  children: React.ReactNode;
  onDelete: () => void;
  onTap?: () => void;
  className?: string;
}) {
  const REVEAL = 88;
  const OPEN_AT = 44;
  const DELETE_AT = 170;
  const MIN = -240;

  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const openRef = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const axis = useRef<null | "x" | "y">(null);

  function down(e: React.PointerEvent) {
    startX.current = e.clientX;
    startY.current = e.clientY;
    axis.current = null;
    setDragging(true);
  }

  function move(e: React.PointerEvent) {
    if (!dragging) return;
    const dX = e.clientX - startX.current;
    const dY = e.clientY - startY.current;
    if (axis.current === null) {
      if (Math.abs(dX) > 8 || Math.abs(dY) > 8) {
        axis.current = Math.abs(dX) > Math.abs(dY) ? "x" : "y";
        if (axis.current === "x") {
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {}
        }
      }
    }
    if (axis.current !== "x") return;
    const base = openRef.current ? -REVEAL : 0;
    setDx(Math.max(MIN, Math.min(0, base + dX)));
  }

  function up() {
    setDragging(false);
    if (axis.current === null) {
      // A tap: close if open, otherwise pass through.
      if (openRef.current) {
        openRef.current = false;
        setDx(0);
      } else {
        onTap?.();
      }
      return;
    }
    if (axis.current !== "x") return;
    if (dx <= -DELETE_AT) {
      onDelete();
      return;
    }
    const open = dx <= -OPEN_AT;
    openRef.current = open;
    setDx(open ? -REVEAL : 0);
  }

  return (
    <div className={`relative overflow-hidden rounded-xl ${className}`}>
      <button
        onClick={onDelete}
        aria-label="Delete"
        className="absolute inset-y-0 right-0 flex items-center justify-center bg-red-600 font-semibold text-white"
        style={{ width: REVEAL }}
      >
        Delete
      </button>
      <div
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        className="select-none"
        style={{
          transform: `translateX(${dx}px)`,
          transition: dragging ? "none" : "transform 200ms ease",
          touchAction: "pan-y",
        }}
      >
        {children}
      </div>
    </div>
  );
}
