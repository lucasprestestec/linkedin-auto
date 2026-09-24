"use client";

import { useState, useTransition } from "react";
import { IconAlert, IconFileText, IconSparkles, IconUser, IconX } from "@/components/Icons";
import { summarizeLead } from "./actions";

// Card "A IA conduziu até aqui": aparece quando a conversa precisa de você.
// "Assumir conversa" leva ao campo de resposta; "Ver resumo da IA" pede um
// resumo ao agente (Nous) só quando clicado.
export function HandoffCard({ leadId, firstName, reason, when }: { leadId: string; firstName: string; reason: string; when: string }) {
  const [summary, setSummary] = useState<{ text?: string; error?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function takeOver() {
    const box = document.getElementById("reply-box") as HTMLTextAreaElement | null;
    box?.focus();
    box?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="handoff-card rise">
      <svg className="handoff-arrow" width="70" height="80" viewBox="0 0 70 80" fill="none" aria-hidden="true">
        <path d="M30 6c22 4 34 22 22 42-6 10-16 16-26 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M24 56l1 13 12-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="row" style={{ gap: 14, alignItems: "flex-start" }}>
        <span className="handoff-icon">
          <IconSparkles size={22} />
        </span>
        <div className="stack" style={{ gap: 4, minWidth: 0, paddingRight: 56 }}>
          <strong className="handoff-title">A IA conduziu até aqui</strong>
          <span className="small muted">Agora é com você · {when}</span>
          <p className="handoff-reason">
            {reason}. Continue a conversa com {firstName} e aprofunde a oportunidade.
          </p>
        </div>
      </div>
      <div className="handoff-buttons">
        <button type="button" className="btn btn-dark btn-pill" onClick={takeOver}>
          <IconUser size={18} /> Assumir conversa
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-pill"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setSummary(await summarizeLead(leadId));
            })
          }
        >
          {pending ? <span className="spinner" /> : <IconFileText size={18} />} Ver resumo da IA
        </button>
      </div>
      {summary && (
        <div className={`ai-summary${summary.error ? " error" : ""}`}>
          <div className="row" style={{ justifyContent: "space-between", gap: 8 }}>
            <strong className="small">{summary.error ? "Não deu certo" : "Resumo da IA"}</strong>
            <button type="button" className="kebab" style={{ width: 28, height: 28 }} onClick={() => setSummary(null)} aria-label="Fechar resumo">
              <IconX size={14} />
            </button>
          </div>
          {summary.error ? (
            <p className="small">
              <IconAlert size={14} /> {summary.error}
            </p>
          ) : (
            <p className="small" style={{ whiteSpace: "pre-line" }}>
              {summary.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
