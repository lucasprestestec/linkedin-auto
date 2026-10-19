"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Help } from "@/components/Help";
import { Stepper } from "@/components/Stepper";
import { resetWhatsappNumber, updateWhatsappChannel, whatsappPairingState } from "./actions";

// WhatsApp pelo Deskcomm. O cliente só escaneia o QR Code, desconecta ou troca de número; a chave de
// acesso do CRM é posta uma vez pelo suporte, em /admin. Conectado, mostra as regras (liga/desliga e
// limite diário). A secretária só usa o WhatsApp com quem já deu sinal de interesse.
export function WhatsappCard({
  configured,
  enabled,
  dailyLimit,
  sentToday,
}: {
  // A chave do CRM existe (de /admin ou do servidor): dá para falar com o Deskcomm.
  configured: boolean;
  enabled: boolean;
  dailyLimit: number;
  sentToday: number;
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
  // Desconectar / trocar de número: pede confirmação antes (descarta o vínculo do celular).
  const [confirm, setConfirm] = useState<"disconnect" | "switch" | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const check = useCallback(async (withQr: boolean) => {
    const r = await whatsappPairingState(withQr);
    setSt(r);
    return r;
  }, []);

  async function doReset(mode: "disconnect" | "switch") {
    setBusy(true);
    setResetError(null);
    const r = await resetWhatsappNumber(mode);
    setBusy(false);
    setConfirm(null);
    if (r.error) return setResetError(r.error);
    setSlow(false);
    setGaveUp(false);
    await check(false);
    if (mode === "switch") setAsking(true);
    router.refresh();
  }

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
      <div className="stack" style={{ gap: 12 }}>
        <div className="setting" style={{ padding: 0 }}>
          <div className="setting-text">
            <b>Conectado{st.phone ? ` · ${st.phone}` : ""}</b>
            <small>O assistente usa o WhatsApp só com quem já deu sinal de interesse.</small>
          </div>
          {!confirm && (
            <div className="row" style={{ gap: 8 }}>
              <button type="button" className="btn-line btn-sm" onClick={() => setConfirm("switch")}>
                Trocar de número
              </button>
              <button type="button" className="btn-line btn-sm" onClick={() => setConfirm("disconnect")}>
                Desconectar
              </button>
            </div>
          )}
        </div>
        {resetError && <p className="field-error">{resetError}</p>}
        {confirm && (
          <div className="note stack" style={{ gap: 10 }}>
            <p>
              <b>{confirm === "switch" ? "Trocar de número?" : "Desconectar o WhatsApp?"}</b>{" "}
              {confirm === "switch"
                ? "O número atual é desconectado agora e você lê o QR Code do novo celular. As conversas continuam."
                : "O assistente para de enviar e de ler mensagens até você conectar de novo."}
            </p>
            <div className="row" style={{ gap: 8 }}>
              <button type="button" className="btn-line btn-sm btn-danger-line" disabled={busy} onClick={() => void doReset(confirm)}>
                {busy ? "Aguarde…" : confirm === "switch" ? "Trocar de número" : "Desconectar"}
              </button>
              <button type="button" className="btn-text" disabled={busy} onClick={() => setConfirm(null)}>
                Cancelar
              </button>
            </div>
          </div>
        )}
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
      {resetError && <p className="field-error">{resetError}</p>}
      {gaveUp && !asking && (
        <div className="stack" style={{ gap: 8, alignItems: "flex-start" }}>
          <p className="field-error">O QR Code não saiu. Tente reiniciar a conexão; se continuar, avise o suporte.</p>
          <button type="button" className="btn-line btn-sm" disabled={busy} onClick={() => void doReset("switch")}>
            {busy ? "Reiniciando…" : "Reiniciar a conexão"}
          </button>
        </div>
      )}
      {asking && (
        <div className="note stack" style={{ gap: 10, alignItems: "flex-start" }}>
          {st.state === "qr" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`data:image/png;base64,${st.qr}`} alt="QR Code para conectar o WhatsApp" width={220} height={220} style={{ background: "#fff", padding: 12, borderRadius: 8 }} />
          ) : (
            <>
              <p>Gerando o QR Code… aguarde alguns segundos.</p>
              {slow && (
                <>
                  <p>Está demorando mais que o normal. Reiniciar a conexão costuma resolver (é o caso de um número que foi desvinculado pelo celular).</p>
                  <button type="button" className="btn-line btn-sm" disabled={busy} onClick={() => void doReset("switch")}>
                    {busy ? "Reiniciando…" : "Reiniciar a conexão"}
                  </button>
                </>
              )}
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
