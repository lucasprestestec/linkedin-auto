"use client";

import { useState, useTransition } from "react";
import { testEmail } from "./actions";

// Configuração técnica do e-mail. O corretor só vê o botão "Conectar com
// Google" em Canais; aqui ficam as chaves do app e o plano B (senha de app).
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
    <div className="stack" style={{ gap: 12 }}>
      <div className="setting" style={{ padding: 0 }}>
        <span className="setting-text" style={{ minWidth: 0 }}>
          <b>{connectedAddress ? "Caixa conectada" : "Nenhuma caixa conectada"}</b>
          <small style={{ wordBreak: "break-all" }}>
            {connectedAddress ? `${connectedAddress} · ${provider === "google" ? "login Google" : "senha de app"}` : "O corretor conecta em Canais"}
          </small>
        </span>
        {connectedAddress && (
          <button type="button" className="btn-line btn-sm" disabled={pending} onClick={() => start(async () => setResult(await testEmail()))}>
            {pending ? "Testando…" : "Testar conexão"}
          </button>
        )}
      </div>
      {result && (result.error ? <p className="field-error">{result.error}</p> : <p className="ok-text">Envio e leitura funcionando.</p>)}

      <details className="fold">
        <summary>Login com Google: {googleConfigured ? "ativado" : "falta configurar"}</summary>
        <div className="fold-body">
          <ol className="small muted" style={{ paddingLeft: 18, display: "grid", gap: 6, margin: 0 }}>
            <li>
              No Google Cloud Console, crie um projeto e ative a <b>Gmail API</b> e a <b>Google Calendar API</b>.
            </li>
            <li>
              Tela de consentimento OAuth: tipo <b>Externo</b>, escopos <code>gmail.send</code>, <code>gmail.readonly</code> e <code>calendar.events</code>, e{" "}
              <b>Publicar app</b> (em &quot;Teste&quot; a conexão cai a cada 7 dias).
            </li>
            <li>
              Credenciais, ID do cliente OAuth, <b>Aplicativo da Web</b>, com o URI de redirecionamento:
              <br />
              <code style={{ wordBreak: "break-all" }}>{redirectUri}</code>
            </li>
            <li>
              Na Vercel: <code>GOOGLE_CLIENT_ID</code> e <code>GOOGLE_CLIENT_SECRET</code>, e faça um novo deploy.
            </li>
          </ol>
          {!appUrlSet && <p className="field-error">APP_URL não está definido: sem ele não há rastreio de abertura dos e-mails.</p>}
        </div>
      </details>

      <details className="fold">
        <summary>Plano B: senha de app (sem Google)</summary>
        <div className="fold-body">
          <p className="small muted">
            Só se o login com Google não for possível. Na Vercel: <code>EMAIL_ADDRESS</code>, <code>EMAIL_PASSWORD</code> (senha de app) e, para provedores
            que não sejam Gmail/Outlook, <code>EMAIL_PROVIDER=custom</code> + <code>EMAIL_SMTP_HOST</code>, <code>EMAIL_SMTP_PORT</code>,{" "}
            <code>EMAIL_IMAP_HOST</code>, <code>EMAIL_IMAP_PORT</code>. O login com Google, quando conectado, tem prioridade.
          </p>
        </div>
      </details>
    </div>
  );
}
