"use client";

import { useState, useTransition } from "react";
import { FEEDBACK_REASONS } from "@/lib/writingStyle";

// "Não é meu jeito": o corretor escolhe o que não ficou bom (um ou mais motivos) e, se quiser,
// escreve uma linha. Não muda nada na mensagem: só ensina o assistente.
export function FeedbackPanel({
  reasonKeys,
  title,
  placeholder,
  onSubmit,
  onDone,
}: {
  reasonKeys: string[];
  title: string;
  placeholder: string;
  onSubmit: (reasons: string[], note: string) => Promise<{ error?: string }>;
  onDone: () => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();
  const options = FEEDBACK_REASONS.filter((r) => reasonKeys.includes(r.key));

  function toggle(key: string) {
    setPicked((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));
  }

  function send() {
    setError(null);
    startTransition(async () => {
      const r = await onSubmit(picked, note);
      if (r.error) setError(r.error);
      else setSent(true);
    });
  }

  if (sent) {
    return (
      <div className="note stack" style={{ gap: 8 }} role="status">
        <p>Anotado. Quando isso se repetir, eu sugiro uma regra em Conta &rsaquo; Meu jeito de escrever.</p>
        <div>
          <button type="button" className="btn-text" onClick={onDone}>
            Fechar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="note stack" style={{ gap: 10 }}>
      <b className="small">{title}</b>
      <div className="tabs" role="group" aria-label="Motivos" style={{ flexWrap: "wrap" }}>
        {options.map((r) => (
          <button key={r.key} type="button" aria-pressed={picked.includes(r.key)} onClick={() => toggle(r.key)} disabled={pending}>
            {r.label}
          </button>
        ))}
      </div>
      <textarea
        className="field"
        rows={2}
        value={note}
        maxLength={500}
        onChange={(e) => setNote(e.target.value)}
        placeholder={placeholder}
        aria-label="Observação"
        disabled={pending}
      />
      {error && <p className="field-error">{error}</p>}
      <div className="row wrap" style={{ gap: 8 }}>
        <button type="button" className="btn-solid btn-sm" onClick={send} disabled={pending || (picked.length === 0 && !note.trim())}>
          {pending ? "Enviando…" : "Enviar"}
        </button>
        <button type="button" className="btn-line btn-sm" onClick={onDone} disabled={pending}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
