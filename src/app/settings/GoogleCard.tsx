"use client";

import { useState, useTransition } from "react";
import { disconnectEmail } from "./actions";

const RESULT: Record<string, { ok: boolean; text: string }> = {
  conectado: { ok: true, text: "Conta Google conectada." },
  cancelado: { ok: false, text: "Conexão cancelada no Google." },
  expirou: { ok: false, text: "A tela do Google demorou demais. Tente de novo." },
  falhou: { ok: false, text: "Não foi possível conectar. Tente de novo; se persistir, fale com o suporte." },
  "nao-configurado": { ok: false, text: "O login com Google ainda não foi ativado no sistema. Fale com o suporte." },
};

// Conta Google do corretor: serve à agenda (reuniões marcadas sozinhas) e aos avisos por e-mail (resumo do dia e
// equipe). NÃO é usada para prospectar: o envio de e-mail da prospecção sai pelas caixas de envio, em outra linha.
export function GoogleCard({
  googleAddress,
  expired,
  calendarEnabled,
  configured,
  result,
}: {
  googleAddress: string | null;
  expired: boolean;
  calendarEnabled: boolean;
  configured: boolean;
  result: string | null;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const feedback = result ? RESULT[result] : null;
  const connected = Boolean(googleAddress) && !expired;

  return (
    <div id="google" className="stack" aria-label="Conta Google" style={{ scrollMarginTop: 90 }}>
      <div className="setting" style={{ padding: 0 }}>
        <div className="setting-text">
          <b>{connected ? `Conectada · ${googleAddress}` : expired ? "Precisa reconectar" : "Não conectada"}</b>
          <small>
            {connected
              ? "Usada para a agenda de reuniões e para os avisos por e-mail (resumo do dia e equipe). Não é usada para prospectar."
              : expired
                ? "O Google pediu para confirmar o acesso de novo."
                : "Você entra pelo Google, sem passar senha. Serve para a agenda de reuniões e para os avisos por e-mail."}
          </small>
        </div>
        {googleAddress && !confirming && (
          <button type="button" className="btn-line btn-sm" onClick={() => setConfirming(true)}>
            Desconectar
          </button>
        )}
      </div>

      {feedback && <p className={feedback.ok ? "ok-text" : "field-error"}>{feedback.text}</p>}

      {connected && !calendarEnabled && (
        <div className="note stack" style={{ gap: 8, alignItems: "flex-start" }}>
          <p>A conta está conectada, mas sem a permissão da agenda: o assistente não consegue marcar reuniões. Reconecte e marque a permissão de agenda.</p>
          {configured && (
            <a href="/api/email/google/start" className="btn-solid btn-sm">
              Reconectar o Google
            </a>
          )}
        </div>
      )}

      {!connected &&
        (configured ? (
          <div>
            <a href="/api/email/google/start" className="btn-solid">
              {expired ? "Reconectar com Google" : "Conectar com Google"}
            </a>
            <p className="hint">Entre com a conta em que você mantém a sua agenda. Se o Google avisar que o app não foi verificado, toque em Avançado e depois em Continuar.</p>
          </div>
        ) : (
          <p className="hint">O login do Google ainda não foi ativado neste sistema. Fale com o suporte.</p>
        ))}

      {googleAddress && confirming && (
        <div className="note stack" style={{ gap: 10 }}>
          <p>
            <b>Desconectar a conta Google?</b> O assistente deixa de ver seus horários e de marcar reuniões, e os avisos por e-mail param. As conversas continuam aqui.
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
