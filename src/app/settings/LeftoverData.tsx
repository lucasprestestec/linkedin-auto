"use client";

import { useState, useTransition } from "react";
import { deleteLinkedinData } from "./actions";

// Sobras de um LinkedIn que já foi desconectado: pessoas e conversas que
// continuam na tela. Apagar é irreversível, por isso confirma.
export function LeftoverData({ count }: { count: number }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const many = count > 1;

  return (
    <div className="note stack" style={{ gap: 10 }}>
      <p>
        {count} {many ? "pessoas" : "pessoa"} de um LinkedIn desconectado {many ? "continuam" : "continua"} nas suas conversas.
      </p>
      {confirming ? (
        <div className="row wrap" style={{ gap: 8 }}>
          <button type="button" className="btn-line btn-sm btn-danger-line" disabled={pending} onClick={() => start(() => deleteLinkedinData())}>
            {pending ? "Apagando…" : `Apagar ${many ? `as ${count}` : "a pessoa"} para sempre`}
          </button>
          <button type="button" className="btn-text" disabled={pending} onClick={() => setConfirming(false)}>
            Cancelar
          </button>
        </div>
      ) : (
        <div>
          <button type="button" className="btn-line btn-sm" onClick={() => setConfirming(true)}>
            Apagar conversas antigas
          </button>
        </div>
      )}
    </div>
  );
}
