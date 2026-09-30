"use client";

import { useActionState, useState } from "react";
import { updateAgentInstructions } from "./actions";

export function AgentInstructionsForm({ value }: { value: string }) {
  const [state, formAction, pending] = useActionState(updateAgentInstructions, undefined);
  const [text, setText] = useState(value);
  const dirty = text.trim() !== value.trim();

  return (
    <form action={formAction} className="form">
      <textarea
        name="agentInstructions"
        className="field"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        aria-label="Instruções do agente de IA"
        placeholder="Ex: Vendo planos de saúde empresariais para empresas de 10 a 200 vidas em Porto Alegre. Principais objeções: preço e carência. Se pedirem cotação, passe pra mim."
        style={{ minHeight: 160 }}
      />
      <div className="form-actions">
        {dirty ? (
          <button type="submit" className="btn-solid btn-sm" disabled={pending}>
            {pending ? "Salvando…" : "Salvar"}
          </button>
        ) : (
          state?.saved && <span className="ok-text">Salvo</span>
        )}
        <span className="hint" style={{ margin: 0 }}>
          {text.trim() ? `${text.trim().length} caracteres` : "Sem instruções: o agente responde de forma genérica"}
        </span>
      </div>
    </form>
  );
}
