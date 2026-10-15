"use client";

import { useState, useTransition } from "react";
import { runRobotNow } from "./actions";

// Chama o robô na hora (o mesmo que roda sozinho de 15 em 15 minutos): útil nos testes, para ver o
// rascunho ou ler uma resposta sem esperar.
export function RunRobotButton() {
  const [result, setResult] = useState<{ error?: string; lines?: string[] } | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="stack" style={{ gap: 8 }}>
      <div>
        <button
          type="button"
          className="btn-line btn-sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setResult(await runRobotNow());
            })
          }
        >
          {pending ? "Rodando…" : "Rodar agora"}
        </button>
      </div>
      {result?.error && <p className="field-error">{result.error}</p>}
      {result?.lines?.map((l) => (
        <small key={l}>{l}</small>
      ))}
    </div>
  );
}
