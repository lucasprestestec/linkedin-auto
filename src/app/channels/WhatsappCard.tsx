"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Help } from "@/components/Help";
import { Stepper } from "@/components/Stepper";
import { connectDeskcomm, disconnectDeskcomm, updateWhatsappChannel, whatsappPairingState } from "./actions";

// WhatsApp pelo Deskcomm. O cliente só escaneia o QR Code; endereço e chave são
// postos uma vez pelo suporte (variáveis do servidor, ou o formulário dobrado
// abaixo). Conectado, mostra as regras (liga/desliga e limite diário). A
// secretária só usa o WhatsApp com quem já deu sinal de interesse.
export function WhatsappCard({
  configured,
  tokenFixed,
  host,
  channelId,
  enabled,
  dailyLimit,
  sentToday,
  fixedAddress,
}: {
  // Endereço e chave existem (do servidor ou salvos): dá para falar com o Deskcomm.
  configured: boolean;
  // A chave vem do servidor (DESKCOMM_TOKEN): o cliente não vê nem troca.
  tokenFixed: boolean;
  host: string | null;
  channelId: string | null;
  enabled: boolean;
  dailyLimit: number;
  sentToday: number;
  // O servidor tem endereço único: o suporte não precisa informá-lo.
  fixedAddress: boolean;
}) {
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [rules, setRules] = useState({ enabled, dailyLimit });
  const [, start] = useTransition();

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
      {configured ? (
        <Pairing />
      ) : (
        <div className="setting" style={{ padding: 0 }}>
          <div className="setting-text">
            <b>Ainda não preparado</b>
            <small>O suporte faz uma configuração, uma única vez. Depois disso, você só lê um QR Code com o celular.</small>
          </div>
        </div>
      )}

      {message && <p className={message.ok ? "ok-text" : "field-error"}>{message.text}</p>}

      {configured && (
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

      {!tokenFixed && <SupportForm configured={configured} host={host} channelId={channelId} fixedAddress={fixedAddress} />}
    </div>
  );
}

// Estado do número + botão do QR Code. Ao abrir só olha o estado; o QR (que
// pode reiniciar a sessão no Deskcomm) só é pedido quando a pessoa clica.
function Pairing() {
  const router = useRouter();
  const [st, setSt] = useState<Awaited<ReturnType<typeof whatsappPairingState>> | null>(null);
  const [asking, setAsking] = useState(false);
  // slow: o QR passa de ~1 minuto sem sair; gaveUp: parou de tentar (4 minutos).
  const [slow, setSlow] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);
  const tries = useRef(0);

  const check = useCallback(async (withQr: boolean) => {
    const r = await whatsappPairingState(withQr);
    setSt(r);
    return r;
  }, []);

  useEffect(() => {
    let alive = true;
    void whatsappPairingState(false).then((r) => alive && setSt(r));
    return () => {
      alive = false;
    };
  }, []);

  // Com o QR na tela: renova a cada poucos segundos (ele vence em ~1 min) até conectar.
  useEffect(() => {
    if (!asking) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    tries.current = 0;
    const tick = async () => {
      const r = await check(true);
      if (stop) return;
      if (r.state === "connected") {
        setAsking(false);
        router.refresh();
        return;
      }
      if (r.state === "error" || ++tries.current > 60) {
        setGaveUp(r.state !== "error");
        setAsking(false);
        return;
      }
      if (tries.current > 15) setSlow(true);
      timer = setTimeout(tick, 4000);
    };
    void tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [asking, check, router]);

  if (!st) {
    return (
      <div className="setting" style={{ padding: 0 }}>
        <div className="setting-text">
          <b>Verificando…</b>
        </div>
      </div>
    );
  }

  if (st.state === "connected") {
    return (
      <div className="setting" style={{ padding: 0 }}>
        <div className="setting-text">
          <b>Conectado{st.phone ? ` · ${st.phone}` : ""}</b>
          <small>O assistente usa o WhatsApp só com quem já deu sinal de interesse.</small>
        </div>
      </div>
    );
  }

  if (st.state === "none") {
    return (
      <div className="setting" style={{ padding: 0 }}>
        <div className="setting-text">
          <b>Número ainda não criado</b>
          <small>O suporte precisa criar o número no sistema de WhatsApp. Depois, volte aqui para ler o QR Code.</small>
        </div>
      </div>
    );
  }

  if (st.state === "error") {
    return (
      <div className="stack" style={{ gap: 10 }}>
        <p className="field-error">{st.message}</p>
        <div>
          <button type="button" className="btn-line btn-sm" onClick={() => void check(false)}>
            Tentar de novo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="setting" style={{ padding: 0 }}>
        <div className="setting-text">
          <b>Não conectado</b>
          <small>Leia o QR Code com o celular que vai usar o WhatsApp do assistente.</small>
        </div>
        {!asking && (
          <button
            type="button"
            className="btn-solid btn-sm"
            onClick={() => {
              setSlow(false);
              setGaveUp(false);
              setAsking(true);
            }}
          >
            Conectar com QR Code
          </button>
        )}
      </div>
      {gaveUp && !asking && (
        <p className="field-error">O QR Code não saiu. O servidor de WhatsApp pode estar com problema: avise o suporte e tente de novo depois.</p>
      )}
      {asking && (
        <div className="note stack" style={{ gap: 10, alignItems: "flex-start" }}>
          {st.state === "qr" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`data:image/png;base64,${st.qr}`} alt="QR Code para conectar o WhatsApp" width={220} height={220} style={{ background: "#fff", padding: 12, borderRadius: 8 }} />
          ) : (
            <>
              <p>Gerando o QR Code… aguarde alguns segundos.</p>
              {slow && <p>Está demorando mais que o normal. Se não sair, o servidor de WhatsApp pode estar com problema: avise o suporte.</p>}
            </>
          )}
          <p>
            No celular: <b>WhatsApp → Aparelhos conectados → Conectar um aparelho</b> e aponte para o código. O QR Code se renova sozinho.
          </p>
          <button type="button" className="btn-text" onClick={() => setAsking(false)}>
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}

// Configuração do suporte: endereço e chave digitados à mão. Só aparece quando a
// chave não vem do servidor.
function SupportForm({ configured, host, channelId, fixedAddress }: { configured: boolean; host: string | null; channelId: string | null; fixedAddress: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState({ url: "", token: "", channelId: "" });
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  function connect(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    start(async () => {
      const r = await connectDeskcomm(form);
      if (r.error) return setMessage({ ok: false, text: r.error });
      setMessage({ ok: true, text: "Chave salva." });
      setForm({ url: "", token: "", channelId: "" });
      router.refresh();
    });
  }

  return (
    <details className="fold">
      <summary>Configuração do suporte</summary>
      <div className="fold-body">
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
                required={!configured}
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
              placeholder={configured ? "Deixe em branco para manter a atual" : "Cole a chave"}
              value={form.token}
              onChange={(e) => setForm({ ...form, token: e.target.value })}
              required={!configured}
            />
          </div>
          <div>
            <label className="label">
              Identificador do número <Help>Só para o suporte. Normalmente o número é reconhecido sozinho.</Help>
            </label>
            <input className="field" placeholder={channelId ?? "Reconhecido sozinho"} value={form.channelId} onChange={(e) => setForm({ ...form, channelId: e.target.value })} />
          </div>
          {message && <p className={message.ok ? "ok-text" : "field-error"}>{message.text}</p>}
          <div className="form-actions">
            <button type="submit" className="btn-solid" disabled={pending}>
              {pending ? "Salvando…" : configured ? "Salvar e testar" : "Salvar"}
            </button>
            {configured && !confirming && (
              <button type="button" className="btn-line btn-sm" onClick={() => setConfirming(true)}>
                Desconectar
              </button>
            )}
          </div>
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
                      router.refresh();
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
        </form>
      </div>
    </details>
  );
}
