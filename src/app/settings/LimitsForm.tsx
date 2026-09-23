"use client";

import { useActionState } from "react";
import { updateLimits } from "./actions";

const inputStyle: React.CSSProperties = {
  width: 72,
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg)",
  color: "var(--text)",
  fontSize: 14.5,
};

export function LimitsForm({ dailyInviteLimit, dailyMessageLimit }: { dailyInviteLimit: number; dailyMessageLimit: number }) {
  const [state, formAction, pending] = useActionState(updateLimits, undefined);

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <label htmlFor="dailyInviteLimit" style={{ fontSize: 14 }}>
          Convites novos por dia
        </label>
        <input id="dailyInviteLimit" name="dailyInviteLimit" type="number" min={1} max={50} defaultValue={dailyInviteLimit} style={inputStyle} />
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <label htmlFor="dailyMessageLimit" style={{ fontSize: 14 }}>
          Mensagens novas por dia
        </label>
        <input id="dailyMessageLimit" name="dailyMessageLimit" type="number" min={1} max={80} defaultValue={dailyMessageLimit} style={inputStyle} />
      </div>
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
          {pending ? "Salvando..." : "Salvar limites"}
        </button>
        {state?.saved && <span style={{ fontSize: 12.5, color: "var(--accent-open)" }}>Salvo</span>}
        {state?.error && <span style={{ fontSize: 12.5, color: "var(--danger)" }}>{state.error}</span>}
      </div>
    </form>
  );
}
