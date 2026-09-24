"use client";

import { useOptimistic, useTransition } from "react";
import { IconBot } from "@/components/Icons";
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
    <div className="ai-switch">
      <span className={`ai-switch-icon${active ? " on" : ""}`}>
        <IconBot size={18} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700 }}>Agente de IA {active ? "ativo" : "pausado"}</div>
        <div className="tiny faint" style={{ fontWeight: 500 }}>
          {active ? "Respondendo seus leads sozinho" : "Novas mensagens vêm pra você"}
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={active}
        aria-label={active ? "Pausar agente de IA" : "Ativar agente de IA"}
        className="switch switch-light"
        onClick={handleToggle}
      />
    </div>
  );
}
