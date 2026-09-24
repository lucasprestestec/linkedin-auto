"use client";

import { useState, useTransition } from "react";
import { IconPlus, IconX } from "@/components/Icons";
import { updateLeadTags } from "./actions";

const TONES = ["lav", "peach", "cream", "pink"];

// Etiquetas coloridas com × e um + que abre o campo pra adicionar.
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
    <section className="side-card">
      <div className="side-card-head">
        <h3>Etiquetas</h3>
        <button type="button" className="side-plus" onClick={() => setAdding((a) => !a)} aria-label="Adicionar etiqueta" aria-expanded={adding}>
          {adding ? <IconX size={16} /> : <IconPlus size={18} />}
        </button>
      </div>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        {current.length === 0 && !adding && <span className="small faint">Nenhuma etiqueta ainda.</span>}
        {current.map((t, i) => (
          <span key={t} className={`tone-tag tone-${TONES[i % TONES.length]}`}>
            {t}
            <button type="button" onClick={() => save(current.filter((x) => x !== t))} aria-label={`Remover etiqueta ${t}`}>
              <IconX size={12} strokeWidth={2.6} />
            </button>
          </span>
        ))}
      </div>
      {adding && (
        <div className="stack" style={{ gap: 8 }}>
          <input
            autoFocus
            className="input"
            style={{ height: 42, fontSize: 15 }}
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
            <div className="tag-suggestions">
              {suggestions.map((t) => (
                <button key={t} type="button" onClick={() => add(t)}>
                  <IconPlus size={12} strokeWidth={2.6} /> {t}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
