"use client";

import { useState, useTransition } from "react";
import { disconnectLinkedin } from "./actions";
import { IconLogout } from "@/components/Icons";

// Desconectar pede confirmação: a automação para até conectar de novo.
export function DisconnectButton() {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  if (!confirming) {
    return (
      <button type="button" className="btn btn-secondary btn-block btn-sm" onClick={() => setConfirming(true)}>
        <IconLogout size={15} /> Desconectar ou trocar de conta
      </button>
    );
  }

  return (
    <div className="disconnect-confirm">
      <p className="small">
        <b>Desconectar o LinkedIn?</b> A automação para até você conectar uma conta de novo. Suas conversas e leads continuam
        salvos aqui.
      </p>
      <div className="row" style={{ gap: 8 }}>
        <button type="button" className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => setConfirming(false)} disabled={pending}>
          Cancelar
        </button>
        <button type="button" className="btn btn-danger btn-sm" style={{ flex: 1 }} disabled={pending} onClick={() => start(() => disconnectLinkedin())}>
          {pending ? (
            <>
              <span className="spinner" /> Desconectando…
            </>
          ) : (
            "Desconectar"
          )}
        </button>
      </div>
    </div>
  );
}
