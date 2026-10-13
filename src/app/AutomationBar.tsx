"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { toggleAutomation } from "./actions";

// Liga e desliga o assistente. Cápsula pequena para o topo da tela (não ocupa a linha toda).
export function AutomationBar({ paused, connected, hasName, today }: { paused: boolean; connected: boolean; hasName: boolean; today: string }) {
  const [optimisticPaused, setOptimisticPaused] = useOptimistic(paused);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const on = connected && !optimisticPaused;

  const title = !connected ? "Assistente parado" : on ? "Assistente ligado" : "Assistente pausado";
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
    <div className={`auto-pill${on ? " is-on" : ""}`} title={detail}>
      <i className={`dot-b ${on ? "b-ok" : "b-neutral"}`} />
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
          role="switch"
          aria-checked={on}
          aria-label={on ? "Pausar" : "Ligar"}
          className="switch"
          onClick={() =>
            startTransition(async () => {
              setError(null);
              setOptimisticPaused(!optimisticPaused);
              const r = await toggleAutomation();
              if (r.error) setError(r.error);
            })
          }
        />
      ) : (
        <Link href="/channels" className="btn-line btn-sm">
          Conectar
        </Link>
      )}
    </div>
  );
}
