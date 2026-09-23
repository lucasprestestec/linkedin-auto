"use client";

import { useActionState } from "react";
import { updateAgentInstructions } from "./actions";

export function AgentInstructionsForm({ value }: { value: string }) {
  const [state, formAction, pending] = useActionState(updateAgentInstructions, undefined);

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <textarea
        name="agentInstructions"
        defaultValue={value}
        rows={8}
        placeholder="Descreva o que o agente vende, público, objeções comuns, quando deve parar e chamar você. Sem isso, ele responde de forma genérica."
        style={{
          padding: "10px 12px",
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: "var(--bg)",
          color: "var(--text)",
          fontSize: 13.5,
          fontFamily: "inherit",
          resize: "vertical",
          lineHeight: 1.5,
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          type="submit"
          disabled={pending}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--text)",
            fontSize: 13.5,
            fontWeight: 600,
            cursor: "pointer",
            alignSelf: "flex-start",
          }}
        >
          {pending ? "Salvando..." : "Salvar instruções"}
        </button>
        {state?.saved && <span style={{ fontSize: 12.5, color: "var(--accent-open)" }}>Salvo</span>}
      </div>
    </form>
  );
}
