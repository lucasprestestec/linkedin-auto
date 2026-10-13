"use client";

import { useEffect, useRef, useState } from "react";

// Explicação escondida atrás de um "?": aparece ao tocar, some ao tocar fora.
export function Help({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span className="help" ref={ref}>
      <button type="button" aria-label="Ajuda" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        ?
      </button>
      {open && (
        <span className="help-tip" role="note">
          {children}
        </span>
      )}
    </span>
  );
}
