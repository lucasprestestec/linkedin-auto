"use client";

import { useActionState } from "react";
import { updateTargetAudience } from "./actions";

export function TargetAudienceForm({ value }: { value: string }) {
  const [state, formAction, pending] = useActionState(updateTargetAudience, undefined);

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <textarea
        name="targetAudience"
        defaultValue={value}
        rows={3}
        placeholder="Ex: donos de pequenas empresas em Porto Alegre, sem seguro empresarial"
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
          {pending ? "Salvando..." : "Salvar"}
        </button>
        {state?.saved && <span style={{ fontSize: 12.5, color: "var(--accent-open)" }}>Salvo</span>}
      </div>
    </form>
  );
}
