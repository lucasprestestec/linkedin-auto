"use client";

import { useState, useTransition } from "react";
import { IconAlert, IconChat, IconCheck, IconLogout } from "@/components/Icons";
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
        text: r.channelDetected
          ? "Deskcomm conectado."
          : "Deskcomm conectado, mas não achei o número de onde as conversas novas saem. Informe o ID do canal abaixo.",
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
    <>
      <section className="card card-pad connection" aria-label="WhatsApp">
        <div className="row" style={{ gap: 14 }}>
          <span className="li-mark wa-mark">
            <IconChat size={24} />
          </span>
          <div className="stack" style={{ gap: 3, flex: 1, minWidth: 0 }}>
            <span className="title-md">WhatsApp</span>
            {connected ? (
              <span className="row small" style={{ gap: 8, color: "var(--success-ink)", fontWeight: 700, minWidth: 0 }}>
                <span className="pulse" />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>Conectado pelo Deskcomm · {host}</span>
              </span>
            ) : (
              <span className="row small faint" style={{ fontWeight: 700 }}>
                Opcional · não conectado
              </span>
            )}
          </div>
        </div>

        {connected && !channelId && (
          <p className="error-text">
            <IconAlert size={15} /> Falta o número (canal) de onde as conversas novas saem.
          </p>
        )}

        {message && (
          <p className={message.ok ? "small" : "error-text"} style={message.ok ? { color: "var(--success-ink)" } : undefined}>
            {message.ok ? <IconCheck size={15} /> : <IconAlert size={15} />} {message.text}
          </p>
        )}

        {editing || !connected ? (
          <form className="stack" style={{ gap: 10 }} onSubmit={connect}>
            {!connected && (
              <p className="small muted">
                Pelo seu número conectado no Deskcomm. A secretária só usa o WhatsApp com quem já deu sinal de interesse (respondeu ou abriu seus
                e-mails) — mensagem fria no WhatsApp pode bloquear o número.
              </p>
            )}
            <label className="field" style={{ gap: 4 }}>
              <span className="label">Endereço do Deskcomm</span>
              <input
                className="input"
                inputMode="url"
                placeholder={host ? `Atual: ${host}` : "https://seu-deskcomm.com.br"}
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                required={!connected}
              />
            </label>
            <label className="field" style={{ gap: 4 }}>
              <span className="label">Token de API</span>
              <input
                className="input"
                type="password"
                autoComplete="off"
                placeholder={connected ? "Deixe em branco pra manter o atual" : "dsk_..."}
                value={form.token}
                onChange={(e) => setForm({ ...form, token: e.target.value })}
                required={!connected}
              />
              <span className="tiny faint">
                No Deskcomm: Configurações → API tokens → novo token com &quot;Agentes de IA podem LER o CRM (MCP)&quot;, &quot;…AGIR no CRM (MCP)&quot;
                e &quot;Tratar o token como gerente&quot;.
              </span>
            </label>
            <label className="field" style={{ gap: 4 }}>
              <span className="label">ID do canal (opcional)</span>
              <input
                className="input"
                placeholder={channelId ?? "Detectado sozinho quando já existe alguma conversa"}
                value={form.channelId}
                onChange={(e) => setForm({ ...form, channelId: e.target.value })}
              />
            </label>
            <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
              {connected && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(false)} disabled={pending}>
                  Cancelar
                </button>
              )}
              <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
                {pending ? "Conectando…" : connected ? "Salvar e testar" : "Conectar Deskcomm"}
              </button>
            </div>
          </form>
        ) : (
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => setEditing(true)}>
              Trocar endereço ou token
            </button>
            {!confirming ? (
              <button type="button" className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => setConfirming(true)}>
                <IconLogout size={15} /> Desconectar
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-danger btn-sm"
                style={{ flex: 1 }}
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await disconnectDeskcomm();
                    setConfirming(false);
                    setMessage(null);
                  })
                }
              >
                {pending ? "Desconectando…" : "Confirmar"}
              </button>
            )}
          </div>
        )}
      </section>

      {connected && (
        <>
          <div className="card channel-options" style={{ overflow: "hidden", marginTop: 10 }}>
            <div className="setting-row">
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontWeight: 700 }}>A secretária pode usar o WhatsApp</span>
                <span className="tiny faint">Só com quem já respondeu ou abriu seus e-mails. Desligado, ela só responde quem escrever por lá.</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={rules.enabled}
                aria-label="A secretária pode usar o WhatsApp"
                className="switch switch-light"
                onClick={() => saveRules({ ...rules, enabled: !rules.enabled })}
              />
            </div>
            {rules.enabled && (
              <div className="setting-row">
                <label htmlFor="dailyWhatsappLimit" style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontWeight: 700 }}>Mensagens por dia</span>
                  <span className="tiny faint">Retomadas param no limite; respostas a quem escreveu sempre saem.</span>
                </label>
                <Stepper id="dailyWhatsappLimit" name="dailyWhatsappLimit" value={rules.dailyLimit} min={1} max={60} onChange={(v) => saveRules({ ...rules, dailyLimit: v })} />
              </div>
            )}
          </div>
          <p className="tiny faint channel-foot">
            Hoje: {sentToday} de {rules.dailyLimit} mensagens. No Deskcomm, deixe a IA automática desligada nesse número — quem responde é a
            secretária daqui.
          </p>
        </>
      )}
    </>
  );
}
