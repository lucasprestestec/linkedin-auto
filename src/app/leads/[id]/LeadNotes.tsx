"use client";

import { useState, useTransition } from "react";
import { IconFileText, IconNote, IconPlus } from "@/components/Icons";
import { updateLeadNotes } from "./actions";

// Anotações do corretor (a IA não lê). Mostra o texto num cartão; "Adicionar"
// ou "Editar" abre o campo.
export function LeadNotes({ leadId, notes, author, variant = "side" }: { leadId: string; notes: string; author: string; variant?: "side" | "tab" }) {
  const [saved, setSaved] = useState(notes);
  const [text, setText] = useState(notes);
  const [editing, setEditing] = useState(variant === "tab" && !notes);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      await updateLeadNotes(leadId, text);
      setSaved(text.trim());
      setEditing(false);
    });
  }

  return (
    <section className={variant === "side" ? "side-card" : "stack"} style={variant === "tab" ? { gap: 12 } : undefined}>
      <div className="side-card-head">
        <h3>
          <IconNote size={19} /> Anotações
        </h3>
        {!editing && (
          <button type="button" className="link-btn brand" onClick={() => setEditing(true)}>
            <IconPlus size={15} /> {saved ? "Editar" : "Adicionar"}
          </button>
        )}
      </div>
      {editing ? (
        <div className="stack" style={{ gap: 8 }}>
          <textarea
            autoFocus
            className="textarea"
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Só você vê. Ex.: tem 40 vidas, reajuste vence em março."
            aria-label="Anotações"
            style={{ fontSize: 14.5, resize: "vertical" }}
          />
          <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setText(saved);
                setEditing(false);
              }}
            >
              Cancelar
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={pending}>
              {pending ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </div>
      ) : saved ? (
        <div className="note-box">
          <IconFileText size={18} />
          <div className="stack" style={{ gap: 8, minWidth: 0 }}>
            <p>{saved}</p>
            <span className="tiny faint">Por {author} · a IA não lê as anotações</span>
          </div>
        </div>
      ) : (
        <p className="small faint">Nenhuma anotação. Só você vê o que escrever aqui.</p>
      )}
    </section>
  );
}
