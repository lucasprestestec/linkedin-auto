"use client";

import { useState, useTransition } from "react";
import type { MailboxStatus } from "@prisma/client";
import { setMailboxStatus, testMailbox } from "./actions";

// Pausar, retomar, testar e aposentar uma caixa.
export function MailboxActions({ id, status }: { id: string; status: MailboxStatus }) {
  const [result, setResult] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <span className="row" style={{ gap: 4, alignItems: "center", flexWrap: "wrap" }}>
      {status !== "RETIRED" && (
        <button
          type="button"
          className="btn-text"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await testMailbox(id);
              setResult(r.error ?? "Funcionando.");
            })
          }
        >
          Testar
        </button>
      )}
      {status === "ACTIVE" && (
        <button type="button" className="btn-text" disabled={pending} onClick={() => start(() => setMailboxStatus(id, "PAUSED"))}>
          Pausar
        </button>
      )}
      {status === "PAUSED" && (
        <button type="button" className="btn-text" disabled={pending} onClick={() => start(() => setMailboxStatus(id, "ACTIVE"))}>
          Retomar
        </button>
      )}
      {status !== "RETIRED" ? (
        <button
          type="button"
          className="btn-text"
          disabled={pending}
          onClick={() => {
            if (window.confirm("Aposentar esta caixa? Ela para de enviar e de ler respostas. O histórico fica.")) start(() => setMailboxStatus(id, "RETIRED"));
          }}
        >
          Aposentar
        </button>
      ) : (
        <button type="button" className="btn-text" disabled={pending} onClick={() => start(() => setMailboxStatus(id, "PAUSED"))}>
          Reativar
        </button>
      )}
      {result && <small className="hint">{result}</small>}
    </span>
  );
}
