"use client";

import { useActionState } from "react";
import { sendReply } from "./actions";

export function ReplyForm({ leadId }: { leadId: string }) {
  const action = sendReply.bind(null, leadId);
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form
      action={formAction}
      style={{
        display: "flex",
        gap: 8,
        padding: 12,
        borderTop: "1px solid var(--border)",
        background: "var(--surface)",
        position: "sticky",
        bottom: 0,
      }}
    >
      <textarea
        name="content"
        placeholder="Responder..."
        required
        rows={1}
        style={{
          flex: 1,
          resize: "none",
          padding: "10px 12px",
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: "var(--bg)",
          color: "var(--text)",
          fontSize: 14.5,
          fontFamily: "inherit",
        }}
      />
      <button
        type="submit"
        disabled={pending}
        style={{
          padding: "0 18px",
          borderRadius: 8,
          border: "none",
          background: "var(--primary)",
          color: "#fff",
          fontWeight: 600,
          fontSize: 14,
          cursor: "pointer",
          opacity: pending ? 0.7 : 1,
        }}
      >
        {pending ? "..." : "Enviar"}
      </button>
      {state?.error && (
        <p style={{ position: "absolute", bottom: 56, left: 12, color: "var(--danger)", fontSize: 12.5, margin: 0 }}>
          {state.error}
        </p>
      )}
    </form>
  );
}
