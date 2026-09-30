"use client";

import { useState, useTransition } from "react";
import { Help } from "@/components/Help";
import { Stepper } from "@/components/Stepper";
import { connectDeskcomm, disconnectDeskcomm, updateWhatsappChannel } from "./actions";

// WhatsApp pelo Deskcomm: endereço + token de API. Conectado, mostra as regras
// (liga/desliga e limite diário). A secretária só usa o WhatsApp com quem já
// deu sinal de interesse.
export function WhatsappCard({
  host,
  channelId,
  enabled,
  dailyLimit,
  sentToday,
}: {
  host: string | null;
  channelId: string | null;
  enabled: boolean;
  dailyLimit: number;
  sentToday: number;
}) {
  const connected = Boolean(host);
  const [form, setForm] = useState({ url: "", token: "", channelId: "" });
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [rules, setRules] = useState({ enabled, dailyLimit });
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  function connect(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    start(async () => {
      const r = await connectDeskcomm(form);
      if (r.error) return setMessage({ ok: false, text: r.error });
      setMessage({
        ok: true,
        text: r.channelDetected ? "WhatsApp conectado." : "Conectado, mas não achei o número de onde as conversas novas saem. Informe o ID do canal abaixo.",
      });
      setForm({ url: "", token: "", channelId: "" });
      setEditing(!r.channelDetected);
      setConfirming(false);
    });
  }

  function saveRules(next: typeof rules) {
    const prev = rules;
    setRules(next);
    start(async () => {
      const r = await updateWhatsappChannel(next);
      if (r.error) {
        setRules(prev);
        setMessage({ ok: false, text: r.error });
      }
    });
  }

  return (
    <div className="stack" aria-label="WhatsApp">
      <div className="setting" style={{ padding: 0 }}>
        <div className="setting-text">
          <b>{connected ? `Conectado · ${host}` : "Não conectado"}</b>
          <small>
            {connected
              ? channelId
                ? "A secretária usa o WhatsApp só com quem já deu sinal de interesse."
                : "Falta o número de onde as conversas novas saem."
              : "Opcional. A secretária só usa o WhatsApp com quem já respondeu ou abriu seus e-mails."}
          </small>
        </div>
        {connected && !editing && !confirming && (
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn-line btn-sm" onClick={() => setEditing(true)}>
              Trocar
            </button>
            <button type="button" className="btn-line btn-sm" onClick={() => setConfirming(true)}>
              Desconectar
            </button>
          </div>
        )}
      </div>

      {message && <p className={message.ok ? "ok-text" : "field-error"}>{message.text}</p>}

      {confirming && (
        <div className="note stack" style={{ gap: 10 }}>
          <p>
            <b>Desconectar o WhatsApp?</b> A secretária para de enviar e ler mensagens por lá.
          </p>
          <div className="row" style={{ gap: 8 }}>
            <button
              type="button"
              className="btn-line btn-sm btn-danger-line"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await disconnectDeskcomm();
                  setConfirming(false);
                  setMessage(null);
                })
              }
            >
              {pending ? "Desconectando…" : "Desconectar"}
            </button>
            <button type="button" className="btn-text" onClick={() => setConfirming(false)} disabled={pending}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {(editing || !connected) && (
        <form className="form" onSubmit={connect}>
          <div>
            <label className="label">Endereço do Deskcomm</label>
            <input
              className="field"
              inputMode="url"
              placeholder={host ? `Atual: ${host}` : "https://seu-deskcomm.com.br"}
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              required={!connected}
            />
          </div>
          <div>
            <label className="label">
              Chave de acesso{" "}
              <Help>
                No Deskcomm: Configurações, API tokens, novo token com &ldquo;Agentes de IA podem LER o CRM (MCP)&rdquo;, &ldquo;…AGIR no CRM (MCP)&rdquo; e
                &ldquo;Tratar o token como gerente&rdquo;.
              </Help>
            </label>
            <input
              className="field"
              type="password"
              autoComplete="off"
              placeholder={connected ? "Deixe em branco para manter a atual" : "dsk_..."}
              value={form.token}
              onChange={(e) => setForm({ ...form, token: e.target.value })}
              required={!connected}
            />
          </div>
          <div>
            <label className="label">
              Número (opcional){" "}
              <Help>É o ID do canal de onde as conversas novas saem. Se já existe alguma conversa no Deskcomm, ele é encontrado sozinho.</Help>
            </label>
            <input
              className="field"
              placeholder={channelId ?? "Encontrado sozinho quando já há conversa"}
              value={form.channelId}
              onChange={(e) => setForm({ ...form, channelId: e.target.value })}
            />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-solid" disabled={pending}>
              {pending ? "Conectando…" : connected ? "Salvar e testar" : "Conectar"}
            </button>
            {connected && (
              <button type="button" className="btn-text" onClick={() => setEditing(false)} disabled={pending}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      )}

      {connected && (
        <div className="settings">
          <div className="setting">
            <span className="setting-text">
              <b>
                Usar o WhatsApp <Help>Só com quem já respondeu ou abriu seus e-mails. Desligado, a secretária só responde quem escrever por lá.</Help>
              </b>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={rules.enabled}
              aria-label="Usar o WhatsApp"
              className="switch"
              onClick={() => saveRules({ ...rules, enabled: !rules.enabled })}
            />
          </div>
          {rules.enabled && (
            <div className="setting">
              <label htmlFor="dailyWhatsappLimit" className="setting-text">
                <b>
                  Mensagens por dia <Help>Retomadas param no limite. Respostas a quem escreveu sempre saem.</Help>
                </b>
              </label>
              <Stepper id="dailyWhatsappLimit" name="dailyWhatsappLimit" value={rules.dailyLimit} min={1} max={60} onChange={(v) => saveRules({ ...rules, dailyLimit: v })} />
            </div>
          )}
          <p className="hint">
            Hoje: {sentToday} de {rules.dailyLimit} mensagens.{" "}
            <Help>No Deskcomm, deixe a IA automática desligada nesse número: quem responde é a secretária daqui.</Help>
          </p>
        </div>
      )}
    </div>
  );
}
