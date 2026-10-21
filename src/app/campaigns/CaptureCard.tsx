"use client";

import { useState, useTransition } from "react";
import { Help } from "@/components/Help";
import { saveCapture } from "./actions";

interface Props {
  campaignId: string;
  initial: { on: boolean; title: string; text: string; channel: string };
  link: string | null;
  qr: string | null;
  ready: { EMAIL: boolean; WHATSAPP: boolean };
}

// Formulário público da campanha: o link e o QR Code levam a uma página simples; quem preenche entra na campanha
// com o consentimento registrado e a origem "formulário".
export function CaptureCard({ campaignId, initial, link, qr, ready }: Props) {
  const [form, setForm] = useState(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  function save() {
    setMsg(null);
    start(async () => {
      const r = await saveCapture(campaignId, form);
      setMsg("error" in r && r.error ? r.error : "Salvo.");
    });
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMsg("Não consegui copiar. Selecione o endereço e copie à mão.");
    }
  }

  const channelNote =
    (form.channel === "EMAIL" && !ready.EMAIL) || (form.channel === "WHATSAPP" && !ready.WHATSAPP)
      ? "Esse canal ainda não está conectado: o assistente só se apresenta quando estiver."
      : null;

  return (
    <div className="stack" style={{ gap: 12 }}>
      <label className="row" style={{ gap: 8 }}>
        <input type="checkbox" checked={form.on} onChange={(e) => setForm({ ...form, on: e.target.checked })} />
        <b>Receber pessoas por link e QR Code</b>
        <Help>Quem preencher entra nesta campanha já autorizando o contato. Você escolhe se o assistente se apresenta sozinho ou se você começa a conversa.</Help>
      </label>

      {form.on && (
        <>
          <div>
            <label className="label" htmlFor="cap-title">
              Título da página
            </label>
            <input id="cap-title" className="field" value={form.title} maxLength={80} placeholder="Ex.: Plano de saúde para a sua empresa" onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="cap-text">
              Texto curto (opcional)
            </label>
            <textarea id="cap-text" className="field" rows={3} value={form.text} maxLength={400} placeholder="Ex.: Deixe seus dados e receba uma comparação sem compromisso." onChange={(e) => setForm({ ...form, text: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="cap-channel">
              Primeiro contato
            </label>
            <select id="cap-channel" className="field" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
              <option value="">Eu começo a conversa</option>
              <option value="EMAIL">O assistente se apresenta por e-mail</option>
              <option value="WHATSAPP">O assistente se apresenta por WhatsApp</option>
            </select>
            {channelNote && <p className="field-error">{channelNote}</p>}
          </div>
        </>
      )}

      <div className="form-actions">
        <button type="button" className="btn-solid btn-sm" onClick={save} disabled={pending}>
          {pending ? "Salvando…" : "Salvar"}
        </button>
        {msg && <span className="muted small">{msg}</span>}
      </div>

      {initial.on && link && (
        <div className="stack" style={{ gap: 8 }}>
          <label className="label" htmlFor="cap-link">
            Link do formulário
          </label>
          <div className="row" style={{ gap: 8 }}>
            <input id="cap-link" className="field" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
            <button type="button" className="btn-line btn-sm" onClick={copy}>
              {copied ? "Copiado" : "Copiar"}
            </button>
            <a className="btn-line btn-sm" href={link} target="_blank" rel="noreferrer">
              Abrir
            </a>
          </div>
          {qr && (
            <div className="stack" style={{ gap: 6, alignItems: "flex-start" }}>
              <div style={{ width: 180, background: "#fff", padding: 6, borderRadius: 8 }} dangerouslySetInnerHTML={{ __html: qr }} aria-label="QR Code do formulário" role="img" />
              <a className="btn-text" download="qrcode-formulario.svg" href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr)}`}>
                Baixar o QR Code
              </a>
            </div>
          )}
        </div>
      )}
      {initial.on && !link && <p className="field-error">O endereço do sistema (APP_URL) não está configurado: não dá para montar o link.</p>}
    </div>
  );
}
