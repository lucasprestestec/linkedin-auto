"use client";

import { useState, useTransition } from "react";
import { updateLeadTags } from "./actions";

// Etiquetas simples, com um campo pra adicionar.
export function LeadTags({ leadId, tags, knownTags }: { leadId: string; tags: string[]; knownTags: string[] }) {
  const [current, setCurrent] = useState(tags);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [, startTransition] = useTransition();

  function save(next: string[]) {
    setCurrent(next);
    startTransition(async () => {
      const result = await updateLeadTags(leadId, next);
      setCurrent(result.tags);
    });
  }

  function add(raw: string) {
    const tag = raw.trim().toLowerCase();
    setDraft("");
    if (!tag || current.includes(tag)) return;
    save([...current, tag]);
  }

  const suggestions = knownTags.filter((t) => !current.includes(t) && (!draft || t.includes(draft.toLowerCase()))).slice(0, 6);

  return (
    <section className="sec">
      <div className="sec-head">
        <h2 className="t-label">Etiquetas</h2>
        <button type="button" className="btn-text" onClick={() => setAdding((a) => !a)} aria-expanded={adding}>
          {adding ? "Pronto" : "Adicionar"}
        </button>
      </div>
      <div className="row wrap" style={{ gap: 6 }}>
        {current.length === 0 && !adding && <span className="empty">Nenhuma.</span>}
        {current.map((t) => (
          <span key={t} className="tag">
            {t}
            <button type="button" onClick={() => save(current.filter((x) => x !== t))} aria-label={`Remover ${t}`}>
              ×
            </button>
          </span>
        ))}
      </div>
      {adding && (
        <div className="stack" style={{ gap: 8 }}>
          <input
            autoFocus
            className="field"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                add(draft);
              }
            }}
            placeholder="Nova etiqueta e Enter"
            aria-label="Nova etiqueta"
            enterKeyHint="done"
          />
          {suggestions.length > 0 && (
            <div className="row wrap" style={{ gap: 6 }}>
              {suggestions.map((t) => (
                <button key={t} type="button" className="tag" onClick={() => add(t)}>
                  + {t}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
