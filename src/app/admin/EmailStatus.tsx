"use client";

import { useState, useTransition } from "react";
import { IconAlert, IconCheck, IconMail } from "@/components/Icons";
import { testEmail } from "./actions";

// Caixa de e-mail do corretor: conectada ou como configurar. A senha nunca
// passa por aqui — só o endereço e o resultado do teste.
export function EmailStatus({ address }: { address: string | null }) {
  const [result, setResult] = useState<{ smtp: string | null; imap: string | null } | null>(null);
  const [pending, start] = useTransition();

  if (!address) {
    return (
      <div className="card stack" style={{ gap: 10 }}>
        <div className="row" style={{ gap: 10 }}>
          <span className="setting-icon">
            <IconMail size={19} />
          </span>
          <span style={{ fontWeight: 700 }}>Caixa de e-mail não configurada</span>
        </div>
        <p className="small muted">
          Com ela, a secretária manda e responde e-mails pela caixa do próprio corretor (sem serviço pago). Na Vercel, em Environment Variables:
        </p>
        <ul className="small muted" style={{ paddingLeft: 18, display: "grid", gap: 4 }}>
          <li>
            <code>EMAIL_ADDRESS</code> — o endereço (ex.: nome@gmail.com)
          </li>
          <li>
            <code>EMAIL_PASSWORD</code> — senha de app (Gmail: Conta Google → Segurança → Verificação em duas etapas → Senhas de app)
          </li>
          <li>
            <code>EMAIL_FROM_NAME</code> — opcional, o nome no &quot;De:&quot;
          </li>
          <li>
            Outro provedor: <code>EMAIL_PROVIDER=custom</code> + <code>EMAIL_SMTP_HOST</code>, <code>EMAIL_SMTP_PORT</code>, <code>EMAIL_IMAP_HOST</code>,{" "}
            <code>EMAIL_IMAP_PORT</code>
          </li>
        </ul>
        <p className="tiny faint">Depois, faça um novo deploy pra valer.</p>
      </div>
    );
  }

  const ok = result && !result.smtp && !result.imap;
  return (
    <div className="card stack" style={{ gap: 10 }}>
      <div className="row" style={{ gap: 10, justifyContent: "space-between", flexWrap: "wrap" }}>
        <div className="row" style={{ gap: 10, minWidth: 0 }}>
          <span className="setting-icon">
            <IconMail size={19} />
          </span>
          <span className="stack" style={{ gap: 2, minWidth: 0 }}>
            <span style={{ fontWeight: 700 }}>Caixa de e-mail configurada</span>
            <span className="small muted" style={{ wordBreak: "break-all" }}>
              {address}
            </span>
          </span>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={pending}
          onClick={() => start(async () => setResult(await testEmail()))}
        >
          {pending ? "Testando…" : "Testar conexão"}
        </button>
      </div>
      {result &&
        (ok ? (
          <p className="small" style={{ color: "var(--success-ink, #3fd07a)" }}>
            <IconCheck size={15} /> Envio (SMTP) e leitura (IMAP) funcionando.
          </p>
        ) : (
          <div className="stack" style={{ gap: 4 }}>
            {result.smtp && (
              <p className="error-text">
                <IconAlert size={15} /> Envio (SMTP): {result.smtp}
              </p>
            )}
            {result.imap && (
              <p className="error-text">
                <IconAlert size={15} /> Leitura (IMAP): {result.imap}
              </p>
            )}
          </div>
        ))}
      <p className="tiny faint">
        A cada rodada a secretária lê a caixa de entrada e grava, na conversa certa, os e-mails de quem tem esse endereço na ficha. Os demais
        e-mails são ignorados.
      </p>
    </div>
  );
}
