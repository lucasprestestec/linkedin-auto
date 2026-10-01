"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { toggleAutomation } from "./actions";

// Liga e desliga o assistente. Uma linha só.
export function AutomationBar({ paused, connected, hasName, today }: { paused: boolean; connected: boolean; hasName: boolean; today: string }) {
  const [optimisticPaused, setOptimisticPaused] = useOptimistic(paused);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const on = connected && !optimisticPaused;

  return (
    <div className="h-auto">
      <div>
        <b>{!connected ? "Assistente parado" : on ? "Assistente ligado" : "Assistente pausado"}</b>
        <small>
          {!connected
            ? "Conecte o LinkedIn ou o WhatsApp para começar."
            : error
              ? error
              : !hasName && !on
                ? "Falta o seu nome: é com ele que o assistente se apresenta."
                : on
                  ? today
                  : "Nada é enviado enquanto estiver pausada."}
        </small>
      </div>
      {connected && !hasName && !on ? (
        <Link href="/settings" className="btn-line">
          Cadastrar meu nome
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
        <Link href="/channels" className="btn-line">
          Conectar
        </Link>
      )}
    </div>
  );
}
