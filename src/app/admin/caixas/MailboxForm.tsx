"use client";

import { useState, useTransition } from "react";
import { MAILBOX_PRESETS } from "@/lib/mailboxPolicy";
import { addMailbox, type MailboxInput } from "./actions";

const EMPTY: MailboxInput = { address: "", password: "", displayName: "", dailyLimit: 25, smtpHost: "", smtpPort: 465, imapHost: "", imapPort: 993 };

const GOOGLE_PAGES = {
  etapas: "https://myaccount.google.com/signinoptions/twosv",
  appLink: "https://myaccount.google.com/apppasswords",
  conta: "https://myaccount.google.com/security",
};

function ext(href: string, label: string) {
  return (
    <a href={href} target="_blank" rel="noreferrer noopener">
      {label}
    </a>
  );
}

// Onde achar cada informação pedida no formulário.
function Guide({ address }: { address: string }) {
  const domain = address.split("@")[1]?.toLowerCase() ?? "";
  const gmail = domain === "gmail.com" || domain === "googlemail.com";
  return (
    <details className="fold" open={gmail || undefined}>
      <summary>Onde encontro a senha e os servidores?</summary>
      <div className="fold-body">
        {gmail || !domain ? (
          <ol className="small muted" style={{ paddingLeft: 18, display: "grid", gap: 6, margin: 0 }}>
            <li>
              A conta precisa da <b>verificação em duas etapas</b> ligada: {ext(GOOGLE_PAGES.etapas, "abrir verificação em duas etapas")}.
            </li>
            <li>
              Crie uma <b>senha de app</b> (dê o nome &quot;Central Dors&quot;): {ext(GOOGLE_PAGES.appLink, "abrir senhas de app")}. O Google mostra 16 letras; copie e cole
              aqui, sem espaços. <b>Não é a senha do seu Gmail.</b>
            </li>
            <li>Os servidores do Gmail já vêm preenchidos abaixo (envio smtp.gmail.com, porta 465; leitura imap.gmail.com, porta 993).</li>
            <li>
              Se o Google disser que a opção de senha de app não está disponível, confira a segurança da conta: {ext(GOOGLE_PAGES.conta, "abrir segurança da conta")}. Em
              contas de empresa (Workspace), o administrador pode ter desligado as senhas de app.
            </li>
          </ol>
        ) : (
          <p className="small muted">
            Domínio próprio: o endereço, a senha e os servidores de envio (SMTP) e de leitura (IMAP) aparecem no painel do provedor onde a caixa foi criada, geralmente em
            &quot;configurar no programa de e-mail&quot; ou &quot;IMAP/SMTP&quot;. Use a senha da caixa ou, se o provedor oferecer, uma senha de app. As portas mais comuns são 465 para
            envio e 993 para leitura.
          </p>
        )}
      </div>
    </details>
  );
}

// Cadastra uma caixa nova. Gmail e Outlook vêm com os servidores preenchidos; nos demais, repete os servidores da última
// caixa cadastrada (todas costumam ser do mesmo provedor).
export function MailboxForm({ defaults }: { defaults?: Partial<MailboxInput> }) {
  const base: MailboxInput = { ...EMPTY, ...defaults };
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<MailboxInput>(base);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function changeAddress(address: string) {
    const domain = address.split("@")[1]?.toLowerCase() ?? "";
    const preset = domain === "gmail.com" || domain === "googlemail.com" ? MAILBOX_PRESETS.gmail : ["outlook.com", "hotmail.com", "live.com", "msn.com"].includes(domain) ? MAILBOX_PRESETS.outlook : null;
    setForm((f) => (preset ? { ...f, address, smtpHost: preset.smtp.host, smtpPort: preset.smtp.port, imapHost: preset.imap.host, imapPort: preset.imap.port } : { ...f, address }));
  }

  if (!open) {
    return (
      <div>
        <button type="button" className="btn-line btn-sm" onClick={() => setOpen(true)}>
          Adicionar caixa
        </button>
      </div>
    );
  }

  return (
    <form
      className="form"
      style={{ gap: 10 }}
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await addMailbox(form);
          if (r.error) return setError(r.error);
          setForm(base);
          setOpen(false);
        });
      }}
    >
      <Guide address={form.address} />
      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        <label className="grow" style={{ minWidth: 220 }}>
          <span className="label">Endereço da caixa</span>
          <input className="field" type="email" required value={form.address} onChange={(e) => changeAddress(e.target.value)} placeholder="helena@seudominio.com.br" autoComplete="off" />
        </label>
        <label className="grow" style={{ minWidth: 180 }}>
          <span className="label">Senha (senha de app, se o provedor pedir)</span>
          <input className="field" type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" />
        </label>
      </div>
      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        <label className="grow" style={{ minWidth: 180 }}>
          <span className="label">Servidor de envio (SMTP)</span>
          <input className="field" value={form.smtpHost} onChange={(e) => setForm({ ...form, smtpHost: e.target.value })} placeholder="smtp.seuprovedor.com" required />
        </label>
        <label style={{ width: 90 }}>
          <span className="label">Porta</span>
          <input className="field" type="number" value={form.smtpPort} onChange={(e) => setForm({ ...form, smtpPort: Number(e.target.value) })} required />
        </label>
        <label className="grow" style={{ minWidth: 180 }}>
          <span className="label">Servidor de leitura (IMAP)</span>
          <input className="field" value={form.imapHost} onChange={(e) => setForm({ ...form, imapHost: e.target.value })} placeholder="imap.seuprovedor.com" required />
        </label>
        <label style={{ width: 90 }}>
          <span className="label">Porta</span>
          <input className="field" type="number" value={form.imapPort} onChange={(e) => setForm({ ...form, imapPort: Number(e.target.value) })} required />
        </label>
      </div>
      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        <label className="grow" style={{ minWidth: 180 }}>
          <span className="label">Nome que aparece no e-mail (opcional)</span>
          <input className="field" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="Vazio = nome da assistente" />
        </label>
        <label style={{ width: 150 }}>
          <span className="label">Limite por dia</span>
          <input className="field" type="number" min={1} max={100} value={form.dailyLimit} onChange={(e) => setForm({ ...form, dailyLimit: Number(e.target.value) })} />
        </label>
      </div>
      <p className="hint" style={{ margin: 0 }}>
        A caixa começa com poucos e-mails por dia e sobe 1 por dia até o limite, para ganhar reputação. Antes de guardar, o sistema confere se o envio e a leitura funcionam.
      </p>
      <div className="form-actions">
        <button type="submit" className="btn-solid btn-sm" disabled={pending}>
          {pending ? "Conferindo…" : "Cadastrar caixa"}
        </button>
        <button type="button" className="btn-text" onClick={() => setOpen(false)}>
          Cancelar
        </button>
        {error && <span className="field-error">{error}</span>}
      </div>
    </form>
  );
}
