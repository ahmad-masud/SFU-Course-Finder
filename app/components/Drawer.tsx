"use client";
import React from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  widthClass?: string; // e.g., 'max-w-xl'
};

export function Drawer({ open, onClose, title, children, widthClass = "max-w-2xl" }: Props) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    if (open) {
      // Focus the panel for screen readers/keyboard
      setTimeout(() => panelRef.current?.focus(), 0);
    }
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div
      className={`fixed inset-0 z-50 transition ${open ? "pointer-events-auto" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/20 transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
      />
      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`absolute right-0 top-0 h-full w-full ${widthClass} translate-x-0 bg-white dark:bg-zinc-900 shadow-xl transition-transform duration-200 ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-4 py-3">
          <h3 id={titleId} className="text-sm font-semibold">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close panel"
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 px-2 py-1 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-700"
          >
            Close
          </button>
        </div>
        <div className="h-[calc(100%-49px)] overflow-y-auto p-4 text-sm">{children}</div>
      </div>
    </div>
  );
}
