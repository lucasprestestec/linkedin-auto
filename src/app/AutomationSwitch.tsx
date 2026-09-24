"use client";

import { useOptimistic, useTransition } from "react";
import { toggleAutomation } from "./actions";

export function AutomationSwitch({ paused }: { paused: boolean }) {
  const [optimisticPaused, setOptimisticPaused] = useOptimistic(paused);
  const [, startTransition] = useTransition();
  const active = !optimisticPaused;

  function handleToggle() {
    startTransition(async () => {
      setOptimisticPaused(!optimisticPaused);
      await toggleAutomation();
    });
  }

  return (
    <div className="row" style={{ gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>Agente de IA</div>
        <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.62)", fontWeight: 500 }}>
          {active ? "Respondendo seus leads automaticamente" : "Pausado — novas mensagens vêm pra você"}
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={active}
        aria-label={active ? "Pausar agente de IA" : "Ativar agente de IA"}
        className="switch"
        onClick={handleToggle}
      />
    </div>
  );
}
