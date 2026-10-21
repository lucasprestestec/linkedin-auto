"use client";

import { useState, useTransition } from "react";
import { Help } from "@/components/Help";
import { addLeadTask, deleteLeadTask, setLeadTaskDone } from "./actions";

export interface TaskRow {
  id: string;
  title: string;
  // Já formatado no servidor (evita diferença de hidratação por relógio).
  dueLabel: string | null;
  overdue: boolean;
  done: boolean;
}

// Lembretes desta pessoa. Os que vencem aparecem na tela Hoje.
export function LeadTasks({ leadId, tasks, today }: { leadId: string; tasks: TaskRow[]; today: string }) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function add() {
    setError(null);
    start(async () => {
      const r = await addLeadTask(leadId, title, due);
      if ("error" in r && r.error) return setError(r.error);
      setTitle("");
      setDue("");
    });
  }

  return (
    <section className="sec">
      <h2 className="t-label">
        Lembretes
        <Help>O que você combinou de fazer por esta pessoa. No dia marcado, o lembrete aparece na tela Hoje.</Help>
      </h2>
      {tasks.length === 0 ? (
        <p className="empty">Nenhum lembrete.</p>
      ) : (
        <ul className="stack" style={{ gap: 6, listStyle: "none", padding: 0, margin: 0 }}>
          {tasks.map((t) => (
            <li key={t.id} className="row" style={{ gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={t.done} aria-label={`Feito: ${t.title}`} disabled={pending} onChange={(e) => start(async () => void (await setLeadTaskDone(t.id, e.target.checked)))} />
              <span className="grow" style={t.done ? { textDecoration: "line-through", opacity: 0.6 } : undefined}>
                {t.title}
                {t.dueLabel && <small className={t.overdue && !t.done ? "field-error" : "muted"}> · {t.dueLabel}</small>}
              </span>
              <button type="button" className="btn-text" aria-label={`Apagar: ${t.title}`} disabled={pending} onClick={() => start(async () => void (await deleteLeadTask(t.id)))}>
                Apagar
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        <input className="field" style={{ flex: "1 1 180px" }} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Enviar a proposta" aria-label="Novo lembrete" maxLength={160} />
        <input className="field" type="date" min={today} value={due} onChange={(e) => setDue(e.target.value)} aria-label="Data do lembrete" style={{ flex: "0 1 150px" }} />
        <button type="button" className="btn-solid btn-sm" onClick={add} disabled={pending || !title.trim()}>
          Adicionar
        </button>
      </div>
      {error && <p className="field-error">{error}</p>}
    </section>
  );
}
