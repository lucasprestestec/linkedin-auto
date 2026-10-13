"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MessageChannel } from "@prisma/client";
import { saveCadence, type StepInput } from "./actions";

const CHANNEL_OPTIONS: { value: MessageChannel | ""; label: string }[] = [
  { value: "", label: "Mesmo canal da conversa" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "LINKEDIN", label: "LinkedIn" },
  { value: "EMAIL", label: "E-mail" },
];

// Modelo de 5 toques sem resposta: inicial, D+2, D+4, D+7 e D+10 (2 a 3 dias entre toques).
const FIVE_TOUCHES = [2, 4, 7, 10];

export function CadenceEditor({ campaignId, initial, steps }: { campaignId: string; initial: string; steps: StepInput[] }) {
  const router = useRouter();
  const [first, setFirst] = useState(initial);
  const [list, setList] = useState<StepInput[]>(steps);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  function update(i: number, patch: Partial<StepInput>) {
    setSaved(false);
    setList((l) => l.map((st, j) => (j === i ? { ...st, ...patch } : st)));
  }

  function addStep() {
    setSaved(false);
    setList((l) => [...l, { day: (l.at(-1)?.day ?? 0) + 3, channel: null, text: "", notify: false }]);
  }

  function save() {
    setError(null);
    start(async () => {
      const r = await saveCadence(campaignId, first, list);
      if (r.error) return setError(r.error);
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      <section className="sec">
        <div className="setting-text">
          <h2 className="t-label">Mensagem inicial (D0)</h2>
          <small>
            Opcional. Com texto, é ela que abre a conversa (no LinkedIn depois do aceite, ou no primeiro contato que você pediu). Vazia, o assistente escreve a
            abertura.
          </small>
        </div>
        <textarea className="field" rows={6} value={first} onChange={(e) => {
            setSaved(false);
            setFirst(e.target.value);
          }} aria-label="Mensagem inicial" />
      </section>

      {list.length === 0 && (
        <section className="sec">
          <p className="empty" style={{ margin: 0 }}>
            Sem retomadas de texto fixo: quem não responder recebe o acompanhamento normal do assistente.
          </p>
          <div className="form-actions">
            <button
              type="button"
              className="btn-line btn-sm"
              onClick={() => {
                setSaved(false);
                setList(FIVE_TOUCHES.map((day) => ({ day, channel: null, text: "", notify: false })));
              }}
            >
              Começar com 5 toques (D0, D+2, D+4, D+7, D+10)
            </button>
          </div>
        </section>
      )}

      {list.map((st, i) => (
        <section key={i} className="sec">
          <div className="sec-head">
            <h2 className="t-label">
              Passo {i + 1} · D+{st.day}
            </h2>
            <button type="button" className="btn-text" onClick={() => {
                setSaved(false);
                setList((l) => l.filter((_, j) => j !== i));
              }}>
              Remover
            </button>
          </div>
          <div className="row" style={{ gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
            <label style={{ width: 130 }}>
              <span className="label">Dia (D+)</span>
              <input
                className="field"
                type="number"
                min={1}
                max={120}
                value={st.day}
                onChange={(e) => update(i, { day: Number(e.target.value) })}
                aria-label={`Dia do passo ${i + 1}`}
              />
            </label>
            <label className="grow" style={{ minWidth: 200 }}>
              <span className="label">Canal</span>
              <select className="field" value={st.channel ?? ""} onChange={(e) => update(i, { channel: (e.target.value || null) as MessageChannel | null })}>
                {CHANNEL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <textarea
            className="field"
            rows={5}
            value={st.text}
            onChange={(e) => update(i, { text: e.target.value })}
            placeholder={i === 0 ? "[NOME]?" : "Texto aprovado deste passo"}
            aria-label={`Texto do passo ${i + 1}`}
          />
          <div className="setting" style={{ padding: 0 }}>
            <span className="setting-text">
              <b>Avisar você ao enviar</b>
              <small>ex.: no &ldquo;aviso de ligação&rdquo;: você recebe um alerta de que é hora de ligar</small>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={st.notify}
              aria-label={`Avisar ao enviar o passo ${i + 1}`}
              className="switch"
              onClick={() => update(i, { notify: !st.notify })}
            />
          </div>
        </section>
      ))}

      <p className="hint" style={{ margin: 0 }}>
        Campos preenchidos sozinhos: [NOME], [SOBRENOME], [INDICADOR] (quem indicou), [EMPRESA] e [Bom dia / Boa tarde]. Se faltar um dado ou houver
        &ldquo;o(a)&rdquo;/&ldquo;Dr(a).&rdquo;, o assistente ajusta só esse trecho. Os dias contam da mensagem inicial; passos atrasados não saem colados.
      </p>

      <div className="form-actions" style={{ flexWrap: "wrap" }}>
        <button type="button" className="btn-solid btn-sm" onClick={save} disabled={pending}>
          {pending ? "Salvando…" : "Salvar cadência"}
        </button>
        {list.length < 12 && (
          <button type="button" className="btn-line btn-sm" onClick={addStep}>
            Adicionar passo
          </button>
        )}
        {(first || list.length > 0) && (
          <button
            type="button"
            className="btn-text"
            onClick={() => {
              if (window.confirm("Tirar a cadência desta campanha? Quem não responder volta para o acompanhamento normal do assistente.")) {
                setFirst("");
                setList([]);
                start(async () => {
                  await saveCadence(campaignId, "", []);
                  router.refresh();
                });
              }
            }}
          >
            Tirar cadência
          </button>
        )}
        {error && <span className="field-error">{error}</span>}
        {saved && !error && <span className="ok-text">Salvo</span>}
      </div>
    </div>
  );
}
