"use client";

import { useState, useTransition } from "react";
import { Help } from "@/components/Help";
import { updateLeadNotes } from "./actions";

// Anotações só suas (a IA não lê).
export function LeadNotes({ leadId, notes }: { leadId: string; notes: string; author?: string }) {
  const [saved, setSaved] = useState(notes);
  const [text, setText] = useState(notes);
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      await updateLeadNotes(leadId, text);
      setSaved(text.trim());
      setEditing(false);
    });
  }

  return (
    <section className="sec">
      <div className="sec-head">
        <h2 className="t-label">
          Anotações
          <Help>Só você vê. O assistente não lê as anotações.</Help>
        </h2>
        {!editing && (
          <button type="button" className="btn-text" onClick={() => setEditing(true)}>
            {saved ? "Editar" : "Adicionar"}
          </button>
        )}
      </div>
      {editing ? (
        <div className="stack" style={{ gap: 8 }}>
          <textarea
            autoFocus
            className="field"
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ex.: tem 40 vidas, reajuste vence em março."
            aria-label="Anotações"
          />
          <div className="form-actions">
            <button type="button" className="btn-solid btn-sm" onClick={save} disabled={pending}>
              {pending ? "Salvando…" : "Salvar"}
            </button>
            <button
              type="button"
              className="btn-text"
              onClick={() => {
                setText(saved);
                setEditing(false);
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : saved ? (
        <p style={{ whiteSpace: "pre-line" }}>{saved}</p>
      ) : (
        <p className="empty">Nenhuma anotação.</p>
      )}
    </section>
  );
}
