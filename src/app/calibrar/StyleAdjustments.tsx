"use client";

import { useState, useTransition } from "react";
import { removeStyleRule, requestStyleChange, type ChangeOutcome } from "@/app/settings/style-actions";

// "Sugerir mudanças": o corretor escreve do jeito dele e vê, logo em seguida, o que o assistente
// entendeu. Embaixo, a lista dos ajustes ativos, cada um com um botão pra remover.
export function StyleAdjustments({ initialRules }: { initialRules: string[] }) {
  const [rules, setRules] = useState(initialRules);
  const [text, setText] = useState("");
  const [outcome, setOutcome] = useState<ChangeOutcome | null>(null);
  const [pending, startTransition] = useTransition();

  function apply() {
    startTransition(async () => {
      const r = await requestStyleChange(text);
      setOutcome(r);
      setRules(r.rules);
      if (!r.error && r.blocked.length === 0) setText("");
    });
  }

  function remove(rule: string) {
    startTransition(async () => {
      const r = await removeStyleRule(rule);
      setRules(r.rules);
      setOutcome(null);
    });
  }

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="stack" style={{ gap: 8 }}>
        <label className="label" htmlFor="sugerir-mudancas">
          Sugerir mudanças
        </label>
        <textarea
          id="sugerir-mudancas"
          className="field"
          rows={3}
          maxLength={600}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={pending}
          placeholder={'Escreva do seu jeito o que o assistente deve mudar. Ex.: "as frases estão muito grandes", "tá muito formal", "para de usar emoji".'}
        />
        <div className="row wrap" style={{ gap: 8 }}>
          <button type="button" className="btn-solid btn-sm" onClick={apply} disabled={pending || !text.trim()}>
            {pending ? "Aplicando…" : "Aplicar"}
          </button>
        </div>
      </div>

      {outcome && (
        <div className="stack" style={{ gap: 8 }} role="status">
          {outcome.error && <p className="field-error">{outcome.error}</p>}
          {outcome.added.length > 0 && (
            <div className="note note-ok stack" style={{ gap: 4 }}>
              <b className="small">Entendi. Daqui pra frente o assistente vai:</b>
              {outcome.added.map((r) => (
                <span key={r}>• {r}</span>
              ))}
              {outcome.verbatim && <span className="small muted">Não reconheci um tipo de pedido conhecido, então guardei com as suas palavras.</span>}
            </div>
          )}
          {outcome.already.length > 0 && outcome.added.length === 0 && (
            <p className="note">Isso já estava nos seus ajustes: {outcome.already.join(" ")}</p>
          )}
          {outcome.blocked.map((w) => (
            <p key={w.rule} className="note note-warn">
              Isso eu não posso fazer: {w.why}
            </p>
          ))}
          {outcome.notes.map((w) => (
            <p key={w.rule} className="small muted">
              Observação: {w.why}
            </p>
          ))}
        </div>
      )}

      {rules.length > 0 && (
        <div className="stack" style={{ gap: 6 }}>
          <span className="label">Ajustes ativos</span>
          {rules.map((r) => (
            <div key={r} className="row" style={{ gap: 8, justifyContent: "space-between", alignItems: "flex-start" }}>
              <span className="small">{r}</span>
              <button type="button" className="btn-text" onClick={() => remove(r)} disabled={pending} aria-label={`Remover: ${r}`}>
                Remover
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
