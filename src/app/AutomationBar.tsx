"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { toggleAutomation } from "./actions";

// Liga e desliga o assistente: o quadro de situação no topo da tela Hoje.
export function AutomationBar({ paused, connected, hasName, today }: { paused: boolean; connected: boolean; hasName: boolean; today: string }) {
  const [optimisticPaused, setOptimisticPaused] = useOptimistic(paused);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const on = connected && !optimisticPaused;

  const title = !connected ? "Assistente parado" : on ? "Assistente trabalhando" : "Assistente pausado";
  const detail = !connected
    ? "Conecte um canal para começar."
    : error
      ? error
      : !hasName && !on
        ? "Falta o seu nome: é com ele que o assistente se apresenta."
        : on
          ? today
          : "Nada é enviado enquanto estiver pausado.";

  return (
    <div className={`status-box${on ? " is-on" : ""}`}>
      <i className="status-dot" aria-hidden="true" />
      <span className="auto-text">
        <b>{title}</b>
        <small>{detail}</small>
      </span>
      {connected && !hasName && !on ? (
        <Link href="/settings" className="btn-line btn-sm">
          Cadastrar nome
        </Link>
      ) : connected ? (
        <button
          type="button"
          className={on ? "btn-line btn-sm" : "btn-solid btn-sm"}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              setOptimisticPaused(!optimisticPaused);
              const r = await toggleAutomation();
              if (r.error) setError(r.error);
            })
          }
        >
          {on ? "Pausar" : "Ligar"}
        </button>
      ) : (
        <Link href="/channels" className="btn-line btn-sm">
          Conectar
        </Link>
      )}
    </div>
  );
}
