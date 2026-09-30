"use client";

import { useState, useTransition } from "react";
import { disconnectLinkedin, linkedinDataCount } from "./actions";

// Desconectar para o assistente. Se há pessoas e conversas vindas do LinkedIn,
// pergunta se é pra apagar também (quem entrega a conta a outra pessoa não
// deve deixar dados pra trás).
export function DisconnectButton() {
  const [step, setStep] = useState<"idle" | "ask">("idle");
  const [count, setCount] = useState(0);
  const [pending, start] = useTransition();

  function begin() {
    start(async () => {
      setCount(await linkedinDataCount());
      setStep("ask");
    });
  }

  function run(deleteData: boolean) {
    start(async () => {
      await disconnectLinkedin(deleteData);
      setStep("idle");
    });
  }

  if (step === "idle") {
    return (
      <button type="button" className="btn-line btn-sm" onClick={begin} disabled={pending}>
        {pending ? "Um instante…" : "Desconectar"}
      </button>
    );
  }

  return (
    <div className="note stack" style={{ gap: 10 }}>
      <p>
        <b>Desconectar o LinkedIn?</b> O assistente para até você conectar uma conta.
        {count > 0 && (
          <>
            {" "}
            Há {count} {count > 1 ? "pessoas" : "pessoa"} com conversa que {count > 1 ? "vieram" : "veio"} dele. Quer apagar?
          </>
        )}
      </p>
      <div className="row wrap" style={{ gap: 8 }}>
        {count > 0 && (
          <button type="button" className="btn-line btn-sm btn-danger-line" disabled={pending} onClick={() => run(true)}>
            {pending ? "Apagando…" : `Desconectar e apagar ${count > 1 ? `as ${count}` : "a pessoa"}`}
          </button>
        )}
        <button type="button" className="btn-line btn-sm" disabled={pending} onClick={() => run(false)}>
          {count > 0 ? "Desconectar e manter" : "Desconectar"}
        </button>
        <button type="button" className="btn-text" disabled={pending} onClick={() => setStep("idle")}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
