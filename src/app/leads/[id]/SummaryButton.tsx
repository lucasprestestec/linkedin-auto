"use client";

import { useState, useTransition } from "react";
import { IconSparkles } from "@/components/Icons";
import { summarizeLead } from "./actions";

// "Resumir esta conversa": a IA resume só quando você pede (custa uma chamada).
export function SummaryButton({ leadId }: { leadId: string }) {
  const [summary, setSummary] = useState<{ text?: string; error?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  if (summary)
    return (
      <div className="summary-box" role="status">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <b>{summary.error ? "Não deu certo" : "Resumo da conversa"}</b>
          <button type="button" className="btn-text" onClick={() => setSummary(null)}>
            Fechar
          </button>
        </div>
        <p style={{ whiteSpace: "pre-line" }}>{summary.error ?? summary.text}</p>
      </div>
    );

  return (
    <button type="button" className="summary-btn" disabled={pending} onClick={() => startTransition(async () => setSummary(await summarizeLead(leadId)))}>
      <IconSparkles size={16} />
      {pending ? "Resumindo…" : "Resumir esta conversa"}
    </button>
  );
}
