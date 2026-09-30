"use client";

import { useState, useTransition } from "react";
import { summarizeLead } from "./actions";

// Aviso no fim da conversa quando ela passou pra você. "Assumir" leva ao campo de
// resposta; "Ver resumo" pede um resumo à IA só quando clicado.
export function HandoffCard({ leadId, firstName, reason, when }: { leadId: string; firstName: string; reason: string; when: string }) {
  const [summary, setSummary] = useState<{ text?: string; error?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function takeOver() {
    const box = document.getElementById("reply-box") as HTMLTextAreaElement | null;
    box?.focus();
    box?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="note note-warn stack" style={{ gap: 10, marginTop: 8 }}>
      <p>
        <b>Agora é com você</b> · {when}
        <br />
        {reason}. Continue a conversa com {firstName}.
      </p>
      <div className="row wrap" style={{ gap: 8 }}>
        <button type="button" className="btn-solid btn-sm" onClick={takeOver}>
          Responder
        </button>
        <button
          type="button"
          className="btn-line btn-sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setSummary(await summarizeLead(leadId));
            })
          }
        >
          {pending ? "Resumindo…" : "Ver resumo"}
        </button>
      </div>
      {summary && (
        <div className="stack" style={{ gap: 4 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <b className="small">{summary.error ? "Não deu certo" : "Resumo"}</b>
            <button type="button" className="btn-text" onClick={() => setSummary(null)}>
              Fechar
            </button>
          </div>
          <p className="small" style={{ whiteSpace: "pre-line" }}>
            {summary.error ?? summary.text}
          </p>
        </div>
      )}
    </div>
  );
}
