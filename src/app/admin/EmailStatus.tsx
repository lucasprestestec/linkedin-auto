"use client";

import { useState, useTransition } from "react";
import { IconAlert, IconCheck, IconMail } from "@/components/Icons";
import { testEmail } from "./actions";

// Configuração técnica do e-mail. O corretor só vê o botão "Conectar com
// Google" em Conta; aqui ficam as chaves do app e o plano B (senha de app).
export function EmailStatus({
  googleConfigured,
  redirectUri,
  connectedAddress,
  provider,
  appUrlSet,
}: {
  googleConfigured: boolean;
  redirectUri: string;
  connectedAddress: string | null;
  provider: "google" | "password" | null;
  appUrlSet: boolean;
}) {
  const [result, setResult] = useState<{ error: string | null } | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="card stack" style={{ gap: 12 }}>
      <div className="row" style={{ gap: 10, justifyContent: "space-between", flexWrap: "wrap" }}>
        <div className="row" style={{ gap: 10, minWidth: 0 }}>
          <span className="setting-icon">
            <IconMail size={19} />
          </span>
          <span className="stack" style={{ gap: 2, minWidth: 0 }}>
            <span style={{ fontWeight: 700 }}>{connectedAddress ? "Caixa conectada" : "Nenhuma caixa conectada"}</span>
            <span className="small muted" style={{ wordBreak: "break-all" }}>
              {connectedAddress ? `${connectedAddress} · ${provider === "google" ? "login Google" : "senha de app"}` : "O corretor conecta em Conta → E-mail"}
            </span>
          </span>
        </div>
        {connectedAddress && (
          <button type="button" className="btn btn-secondary btn-sm" disabled={pending} onClick={() => start(async () => setResult(await testEmail()))}>
            {pending ? "Testando…" : "Testar conexão"}
          </button>
        )}
      </div>
      {result &&
        (result.error ? (
          <p className="error-text">
            <IconAlert size={15} /> {result.error}
          </p>
        ) : (
          <p className="small" style={{ color: "var(--success-ink)" }}>
            <IconCheck size={15} /> Envio e leitura funcionando.
          </p>
        ))}

      <details>
        <summary className="small" style={{ fontWeight: 700, cursor: "pointer" }}>
          Login com Google: {googleConfigured ? "ativado" : "falta configurar"}
        </summary>
        <ol className="small muted" style={{ paddingLeft: 18, display: "grid", gap: 6, marginTop: 8 }}>
          <li>No Google Cloud Console, crie um projeto e ative a <b>Gmail API</b>.</li>
          <li>
            Tela de consentimento OAuth: tipo <b>Externo</b>, escopos <code>gmail.send</code> e <code>gmail.readonly</code>, e <b>Publicar app</b> (em
            &quot;Teste&quot; a conexão cai a cada 7 dias).
          </li>
          <li>
            Credenciais → ID do cliente OAuth → <b>Aplicativo da Web</b>, com o URI de redirecionamento:
            <br />
            <code style={{ wordBreak: "break-all" }}>{redirectUri}</code>
          </li>
          <li>
            Na Vercel: <code>GOOGLE_CLIENT_ID</code> e <code>GOOGLE_CLIENT_SECRET</code>, e faça um novo deploy.
          </li>
        </ol>
        {!appUrlSet && (
          <p className="tiny" style={{ color: "var(--urgent-ink)", marginTop: 6 }}>
            APP_URL não está definido: sem ele não há rastreio de abertura dos e-mails.
          </p>
        )}
      </details>

      <details>
        <summary className="small" style={{ fontWeight: 700, cursor: "pointer" }}>
          Plano B: senha de app (sem Google)
        </summary>
        <p className="small muted" style={{ marginTop: 8 }}>
          Só se o login com Google não for possível. Na Vercel: <code>EMAIL_ADDRESS</code>, <code>EMAIL_PASSWORD</code> (senha de app) e, para
          provedores que não sejam Gmail/Outlook, <code>EMAIL_PROVIDER=custom</code> + <code>EMAIL_SMTP_HOST</code>, <code>EMAIL_SMTP_PORT</code>,{" "}
          <code>EMAIL_IMAP_HOST</code>, <code>EMAIL_IMAP_PORT</code>. O login com Google, quando conectado, tem prioridade.
        </p>
      </details>
    </div>
  );
}
