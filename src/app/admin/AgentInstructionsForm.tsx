"use client";

import { useActionState, useState } from "react";
import { updateAgentInstructions } from "./actions";
import { IconBot, IconCheck } from "@/components/Icons";

export function AgentInstructionsForm({ value }: { value: string }) {
  const [state, formAction, pending] = useActionState(updateAgentInstructions, undefined);
  const [text, setText] = useState(value);
  const dirty = text.trim() !== value.trim();

  return (
    <form action={formAction} className="card card-pad stack" style={{ gap: 14 }}>
      <div className="row" style={{ gap: 14 }}>
        <span className="setting-icon" style={{ background: "var(--brand-grad)", color: "#fff" }}>
          <IconBot size={20} />
        </span>
        <div className="stack" style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 700 }}>Instruções gerais do agente</span>
          <span className="tiny faint">Produtos, público, objeções e quando chamar você</span>
        </div>
      </div>
      <textarea
        name="agentInstructions"
        className="textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        aria-label="Instruções do agente de IA"
        placeholder="Ex: Vendo planos de saúde empresariais para empresas de 10 a 200 vidas em Porto Alegre. Principais objeções: preço e carência. Se pedirem cotação, passe pra mim."
        style={{ fontSize: 14.5, resize: "vertical", minHeight: 160 }}
      />
      <div className="row" style={{ gap: 12, justifyContent: "space-between" }}>
        <span className="tiny faint">
          {text.trim() ? `${text.trim().length} caracteres` : "Sem instruções — o agente responde de forma genérica"}
        </span>
        {dirty ? (
          <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
            {pending ? "Salvando…" : "Salvar"}
          </button>
        ) : (
          state?.saved && (
            <span className="success-text">
              <IconCheck size={15} strokeWidth={3} /> Salvo
            </span>
          )
        )}
      </div>
    </form>
  );
}
