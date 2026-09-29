"use client";

import { useState, useTransition } from "react";
import { IconAlert, IconCheck, IconLogout, IconMail } from "@/components/Icons";
import { disconnectEmail } from "./actions";

const RESULT: Record<string, { ok: boolean; text: string }> = {
  conectado: { ok: true, text: "E-mail conectado." },
  cancelado: { ok: false, text: "Conexão cancelada no Google." },
  expirou: { ok: false, text: "A tela do Google demorou demais. Tente de novo." },
  falhou: { ok: false, text: "Não foi possível conectar. Tente de novo; se persistir, fale com o suporte." },
  "nao-configurado": { ok: false, text: "O login com Google ainda não foi ativado no sistema. Fale com o suporte." },
};

// E-mail é uma camada extra: o LinkedIn continua sendo o principal. Conectar é
// um clique no Google — sem senha — e dá pra revogar quando quiser.
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
    <section id="email" className="card card-pad connection rise" aria-label="E-mail" style={{ scrollMarginTop: 90 }}>
      <div className="row" style={{ gap: 14 }}>
        <span className="li-mark mail-mark">
          <IconMail size={24} />
        </span>
        <div className="stack" style={{ gap: 3, flex: 1, minWidth: 0 }}>
          <span className="title-md">E-mail</span>
          {connected ? (
            <span className="row small" style={{ gap: 8, color: "var(--success-ink)", fontWeight: 700, minWidth: 0 }}>
              <span className="pulse" />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>Conectado · {googleAddress}</span>
            </span>
          ) : fallbackAddress ? (
            <span className="row small" style={{ gap: 8, color: "var(--success-ink)", fontWeight: 700 }}>
              <span className="pulse" />
              Conectado pelo suporte · {fallbackAddress}
            </span>
          ) : (
            <span className="row small faint" style={{ gap: 8, fontWeight: 700 }}>
              {expired ? "Conexão expirou" : "Opcional · não conectado"}
            </span>
          )}
        </div>
      </div>

      {feedback && (
        <p className={feedback.ok ? "small" : "error-text"} style={feedback.ok ? { color: "var(--success-ink)" } : undefined}>
          {feedback.ok ? <IconCheck size={15} /> : <IconAlert size={15} />} {feedback.text}
        </p>
      )}

      {!connected && (
        <>
          <p className="small muted">
            {expired
              ? "O Google pediu pra confirmar o acesso de novo. Reconecte pra secretária voltar a mandar e ler e-mails."
              : "Uma camada a mais além do LinkedIn: a secretária manda e-mails pela sua conta, vê quem abriu e usa isso pra decidir o próximo passo. Você entra pelo Google, sem passar senha."}
          </p>
          <a href="/api/email/google/start" className="btn btn-primary btn-block google-btn">
            <GoogleG /> {expired ? "Reconectar com Google" : "Conectar com Google"}
          </a>
          <p className="tiny faint">
            Se o Google avisar que o app &quot;não foi verificado&quot;, toque em <b>Avançado → Continuar</b>. O acesso pode ser removido a qualquer
            momento em myaccount.google.com.
          </p>
        </>
      )}

      {googleAddress &&
        (!confirming ? (
          <button type="button" className="btn btn-secondary btn-block btn-sm" onClick={() => setConfirming(true)}>
            <IconLogout size={15} /> Desconectar e-mail
          </button>
        ) : (
          <div className="disconnect-confirm">
            <p className="small">
              <b>Desconectar o e-mail?</b> A secretária para de mandar e ler e-mails. O histórico das conversas continua aqui.
            </p>
            <div className="row" style={{ gap: 8 }}>
              <button type="button" className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => setConfirming(false)} disabled={pending}>
                Cancelar
              </button>
              <button type="button" className="btn btn-danger btn-sm" style={{ flex: 1 }} disabled={pending} onClick={() => start(() => disconnectEmail())}>
                {pending ? "Desconectando…" : "Desconectar"}
              </button>
            </div>
          </div>
        ))}
    </section>
  );
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
