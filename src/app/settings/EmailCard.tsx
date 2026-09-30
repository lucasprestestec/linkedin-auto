"use client";

import { useState, useTransition } from "react";
import { disconnectEmail } from "./actions";

const RESULT: Record<string, { ok: boolean; text: string }> = {
  conectado: { ok: true, text: "E-mail conectado." },
  cancelado: { ok: false, text: "Conexão cancelada no Google." },
  expirou: { ok: false, text: "A tela do Google demorou demais. Tente de novo." },
  falhou: { ok: false, text: "Não foi possível conectar. Tente de novo; se persistir, fale com o suporte." },
  "nao-configurado": { ok: false, text: "O login com Google ainda não foi ativado no sistema. Fale com o suporte." },
};

// E-mail é uma camada extra: o LinkedIn continua sendo o principal. Conectar é
// um clique no Google, sem senha, e dá pra revogar quando quiser.
export function EmailCard({
  googleAddress,
  expired,
  fallbackAddress,
  result,
}: {
  googleAddress: string | null;
  expired: boolean;
  fallbackAddress: string | null;
  result: string | null;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const feedback = result ? RESULT[result] : null;
  const connected = Boolean(googleAddress) && !expired;

  return (
    <div id="email" className="stack" aria-label="E-mail" style={{ scrollMarginTop: 90 }}>
      <div className="setting" style={{ padding: 0 }}>
        <div className="setting-text">
          <b>
            {connected
              ? `Conectado · ${googleAddress}`
              : fallbackAddress
                ? `Conectado pelo suporte · ${fallbackAddress}`
                : expired
                  ? "Precisa reconectar"
                  : "Não conectado"}
          </b>
          <small>
            {connected || fallbackAddress
              ? "A secretária envia e lê e-mails por esta conta."
              : expired
                ? "O Google pediu para confirmar o acesso de novo."
                : "Você entra pelo Google, sem passar senha."}
          </small>
        </div>
        {googleAddress && !confirming && (
          <button type="button" className="btn-line btn-sm" onClick={() => setConfirming(true)}>
            Desconectar
          </button>
        )}
      </div>

      {feedback && <p className={feedback.ok ? "ok-text" : "field-error"}>{feedback.text}</p>}

      {!connected && (
        <div>
          <a href="/api/email/google/start" className="btn-solid">
            {expired ? "Reconectar com Google" : "Conectar com Google"}
          </a>
          <p className="hint">Se o Google avisar que o app não foi verificado, toque em Avançado e depois em Continuar.</p>
        </div>
      )}

      {googleAddress && confirming && (
        <div className="note stack" style={{ gap: 10 }}>
          <p>
            <b>Desconectar o e-mail?</b> A secretária para de enviar e ler e-mails. As conversas continuam aqui.
          </p>
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn-line btn-sm btn-danger-line" disabled={pending} onClick={() => start(() => disconnectEmail())}>
              {pending ? "Desconectando…" : "Desconectar"}
            </button>
            <button type="button" className="btn-text" onClick={() => setConfirming(false)} disabled={pending}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
