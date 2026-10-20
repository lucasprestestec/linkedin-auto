"use client";

import { useState, useTransition } from "react";
import { IconSparkles } from "@/components/Icons";
import { prepareLeadMeeting, summarizeLead } from "./actions";

const KINDS = {
  summary: { run: summarizeLead, title: "Resumo da conversa", label: "Resumir esta conversa", busy: "Resumindo…" },
  meeting: { run: prepareLeadMeeting, title: "Para a reunião", label: "Preparar a reunião", busy: "Preparando…" },
} as const;

// "Resumir esta conversa" / "Preparar a reunião": a IA só trabalha quando você pede (custa uma chamada).
export function SummaryButton({ leadId, kind = "summary" }: { leadId: string; kind?: keyof typeof KINDS }) {
  const [summary, setSummary] = useState<{ text?: string; error?: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const k = KINDS[kind];

  if (summary)
    return (
      <div className="summary-box" role="status">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <b>{summary.error ? "Não deu certo" : k.title}</b>
          <button type="button" className="btn-text" onClick={() => setSummary(null)}>
            Fechar
          </button>
        </div>
        <p style={{ whiteSpace: "pre-line" }}>{summary.error ?? summary.text}</p>
      </div>
    );

  return (
    <button type="button" className="summary-btn" disabled={pending} onClick={() => startTransition(async () => setSummary(await k.run(leadId)))}>
      <IconSparkles size={16} />
      {pending ? k.busy : k.label}
    </button>
  );
}
