"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { toggleAutomation } from "./actions";

// Linha discreta com o estado da automação e o interruptor.
export function AutomationBar({ paused, connected, today }: { paused: boolean; connected: boolean; today: string }) {
  const [optimisticPaused, setOptimisticPaused] = useOptimistic(paused);
  const [, startTransition] = useTransition();
  const on = connected && !optimisticPaused;

  if (!connected) {
    return (
      <Link href="/settings" className="auto-bar-row off">
        <i className="auto-dot-sm" />
        <span className="auto-bar-text">
          <b>Automação parada</b> · conecte seu LinkedIn pra começar
        </span>
        <span className="auto-bar-cta">Conectar</span>
      </Link>
    );
  }

  return (
    <div className={`auto-bar-row${on ? " on" : " off"}`}>
      <i className="auto-dot-sm" />
      <span className="auto-bar-text">
        <b>{on ? "Automação ligada" : "Automação pausada"}</b> · {on ? today : "nada é enviado enquanto estiver pausada"}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={on ? "Pausar automação" : "Ligar automação"}
        className="switch switch-light"
        onClick={() =>
          startTransition(async () => {
            setOptimisticPaused(!optimisticPaused);
            await toggleAutomation();
          })
        }
      />
    </div>
  );
}
