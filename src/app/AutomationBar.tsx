"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { toggleAutomation } from "./actions";

// Liga e desliga o assistente. Uma linha só.
export function AutomationBar({ paused, connected, today }: { paused: boolean; connected: boolean; today: string }) {
  const [optimisticPaused, setOptimisticPaused] = useOptimistic(paused);
  const [, startTransition] = useTransition();
  const on = connected && !optimisticPaused;

  return (
    <div className="h-auto">
      <div>
        <b>{!connected ? "Assistente parado" : on ? "Assistente ligado" : "Assistente pausado"}</b>
        <small>{!connected ? "Conecte o LinkedIn para começar." : on ? today : "Nada é enviado enquanto estiver pausada."}</small>
      </div>
      {connected ? (
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={on ? "Pausar" : "Ligar"}
          className="switch"
          onClick={() =>
            startTransition(async () => {
              setOptimisticPaused(!optimisticPaused);
              await toggleAutomation();
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
