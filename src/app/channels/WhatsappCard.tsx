"use client";

import { useState, useTransition } from "react";
import { Help } from "@/components/Help";
import { Stepper } from "@/components/Stepper";
import { connectDeskcomm, disconnectDeskcomm, updateWhatsappChannel } from "./actions";

// WhatsApp pelo Deskcomm: chave de acesso (e o endereço, se o servidor não tem um
// fixo). Conectado, mostra as regras (liga/desliga e limite diário). A
// secretária só usa o WhatsApp com quem já deu sinal de interesse.
export function WhatsappCard({
  host,
  channelId,
  enabled,
  dailyLimit,
  sentToday,
  fixedAddress,
}: {
  host: string | null;
  channelId: string | null;
  enabled: boolean;
  dailyLimit: number;
  sentToday: number;
  // O servidor tem endereço único: o cliente não precisa informá-lo.
  fixedAddress: boolean;
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
        text: r.channelDetected ? "WhatsApp conectado." : "WhatsApp conectado. O número é reconhecido sozinho quando a primeira conversa chegar.",
      });
      setForm({ url: "", token: "", channelId: "" });
      setEditing(false);
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
          <b>{connected ? "Conectado" : "Não conectado"}</b>
          <small>
            {connected
              ? channelId
                ? "O assistente usa o WhatsApp só com quem já deu sinal de interesse."
                : "O número é reconhecido sozinho quando a primeira conversa chegar."
              : "Opcional. O assistente só usa o WhatsApp com quem já respondeu ou abriu seus e-mails."}
          </small>
        </div>
        {connected && !editing && !confirming && (
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn-line btn-sm" onClick={() => setEditing(true)}>
              {fixedAddress ? "Trocar chave" : "Trocar"}
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
            <b>Desconectar o WhatsApp?</b> O assistente para de enviar e ler mensagens por lá.
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
          {!fixedAddress && (
            <div>
              <label className="label">
                Endereço da conexão <Help>Fornecido pelo suporte na hora de configurar o WhatsApp.</Help>
              </label>
              <input
                className="field"
                inputMode="url"
                placeholder={host ? "Deixe em branco para manter o atual" : "https://…"}
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                required={!connected}
              />
            </div>
          )}
          <div>
            <label className="label">
              Chave de acesso <Help>Fornecida pelo suporte na hora de configurar o WhatsApp.</Help>
            </label>
            <input
              className="field"
              type="password"
              autoComplete="off"
              placeholder={connected ? "Deixe em branco para manter a atual" : "Cole a chave"}
              value={form.token}
              onChange={(e) => setForm({ ...form, token: e.target.value })}
              required={!connected}
            />
          </div>
          <details className="fold">
            <summary>Opções avançadas</summary>
            <div className="fold-body">
              <div>
                <label className="label">
                  Identificador do número <Help>Só para o suporte. Normalmente o número é reconhecido sozinho quando a primeira conversa chega.</Help>
                </label>
                <input
                  className="field"
                  placeholder={channelId ?? "Reconhecido sozinho"}
                  value={form.channelId}
                  onChange={(e) => setForm({ ...form, channelId: e.target.value })}
                />
              </div>
            </div>
          </details>
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
                Usar o WhatsApp <Help>Só com quem já respondeu ou abriu seus e-mails. Desligado, o assistente só responde quem escrever por lá.</Help>
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
            Hoje: {sentToday} de {rules.dailyLimit} mensagens.
          </p>
        </div>
      )}
    </div>
  );
}
