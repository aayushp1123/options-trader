"use client";

import { useRef, useState, type CSSProperties, type ReactNode } from "react";

const ESTIMATED_TOOLTIP_HEIGHT = 130;

export function InfoTooltip({
  children,
  label,
  className = "",
  style,
}: {
  children: ReactNode;
  label: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const [show, setShow] = useState(false);
  const [placement, setPlacement] = useState<"top" | "bottom">("top");
  const triggerRef = useRef<HTMLSpanElement>(null);

  function updatePlacement() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPlacement(rect.top < ESTIMATED_TOOLTIP_HEIGHT + 16 ? "bottom" : "top");
  }

  function open() {
    updatePlacement();
    setShow(true);
  }

  return (
    <span
      ref={triggerRef}
      className={`relative inline-flex ${className}`}
      style={style}
      onMouseEnter={open}
      onMouseLeave={() => setShow(false)}
    >
      <span tabIndex={0} onFocus={open} onBlur={() => setShow(false)} className="flex-1 cursor-help outline-none">
        {children}
      </span>
      {show && (
        <span
          role="tooltip"
          className={`pointer-events-none absolute left-1/2 z-20 w-56 -translate-x-1/2 rounded-lg border border-line/60 bg-paper-0/85 px-3 py-2 text-xs leading-snug text-ink-700 shadow-lg backdrop-blur-md ${
            placement === "top" ? "bottom-full mb-2" : "top-full mt-2"
          }`}
          style={{ animation: "modal-backdrop-in 120ms ease-out" }}
        >
          {label}
          <span
            className={`absolute left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-line/60 bg-paper-0/85 ${
              placement === "top" ? "top-full -translate-y-1 border-r border-b" : "bottom-full translate-y-1 border-t border-l"
            }`}
          />
        </span>
      )}
    </span>
  );
}
