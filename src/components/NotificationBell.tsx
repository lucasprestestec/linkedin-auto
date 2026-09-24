"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { IconBell, IconSparkles } from "./Icons";
import { useShell } from "./ShellContext";

// Sino: quem a IA passou pra você. O ponto vermelho aparece quando há alguém.
export function NotificationBell() {
  const { needYou, needYouCount } = useShell();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="popover-anchor" ref={ref}>
      <button
        type="button"
        className="round-btn"
        aria-label={needYouCount ? `${needYouCount} conversa${needYouCount > 1 ? "s" : ""} precisam de você` : "Notificações"}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <IconBell size={20} />
        {needYouCount > 0 && <span className="bell-dot" />}
      </button>
      {open && (
        <div className="popover" role="dialog" aria-label="Notificações">
          <div className="popover-head">
            <strong>Precisa de você</strong>
            {needYouCount > 0 && <span className="count">{needYouCount}</span>}
          </div>
          {needYou.length === 0 ? (
            <p className="small faint" style={{ padding: "8px 16px 16px" }}>
              Tudo em dia. A IA avisa aqui quando uma conversa precisar de você.
            </p>
          ) : (
            <ul className="popover-list">
              {needYou.map((n) => (
                <li key={n.id}>
                  <Link href={`/leads/${n.id}`} onClick={() => setOpen(false)}>
                    <span className="popover-icon">
                      <IconSparkles size={15} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <b>{n.name}</b>
                      <span className="truncate">{n.reason}</span>
                    </span>
                    <span className="tiny faint">{n.when}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
