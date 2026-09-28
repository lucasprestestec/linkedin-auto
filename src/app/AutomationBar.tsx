"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { toggleAutomation } from "./actions";
import { IconZap } from "@/components/Icons";

// Estado da automação com o interruptor. "item" é a linha do card Hoje.
export function AutomationBar({
  paused,
  connected,
  today,
  variant = "bar",
}: {
  paused: boolean;
  connected: boolean;
  today: string;
  variant?: "bar" | "item";
}) {
  const [optimisticPaused, setOptimisticPaused] = useOptimistic(paused);
  const [, startTransition] = useTransition();
  const on = connected && !optimisticPaused;

  const toggle = (
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
  );

  if (variant === "item") {
    return (
      <div className={`today-item auto-item${on ? " on" : ""}`}>
        <span className="today-icon">
          <IconZap size={18} />
        </span>
        <span className="today-text">
          <b>{!connected ? "Automação parada" : on ? "Automação ligada" : "Automação pausada"}</b>
          <small>{!connected ? "Conecte seu LinkedIn pra começar" : on ? today : "Nada é enviado enquanto estiver pausada"}</small>
        </span>
        {connected ? (
          toggle
        ) : (
          <Link href="/settings" className="btn btn-gold btn-sm">
            Conectar
          </Link>
        )}
      </div>
    );
  }

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
      {toggle}
    </div>
  );
}
