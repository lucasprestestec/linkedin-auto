"use client";

import { useState, useTransition } from "react";
import type { KnowledgeMode } from "@prisma/client";
import { deleteSection, setSectionMode, updateSection } from "./actions";
import { IconChevronDown, IconTrash } from "@/components/Icons";

interface Section {
  id: string;
  title: string;
  content: string;
  mode: KnowledgeMode;
}

const MODE_LABEL: Record<KnowledgeMode, string> = {
  ALWAYS: "Sempre",
  ON_DEMAND: "Sob demanda",
  OFF: "Desligada",
};

export function KnowledgeList({ sections }: { sections: Section[] }) {
  return (
    <div className="card kb-list">
      {sections.map((s) => (
        <SectionRow key={s.id} section={s} />
      ))}
    </div>
  );
}

function SectionRow({ section }: { section: Section }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(section.title);
  const [content, setContent] = useState(section.content);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = title !== section.title || content !== section.content;
  // "9. Aberturas › 9.1 Indicados": a subseção em destaque, a seção-mãe pequena.
  const cut = section.title.lastIndexOf(" › ");
  const parent = cut > 0 ? section.title.slice(0, cut) : null;
  const own = cut > 0 ? section.title.slice(cut + 3) : section.title;

  return (
    <div className={`kb-row kb-${section.mode.toLowerCase()}`}>
      <div className="kb-head">
        <button type="button" className="kb-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
          <IconChevronDown size={16} style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform .15s" }} />
          <span className="kb-title">
            {parent && <small>{parent}</small>}
            <span>{own}</span>
          </span>
        </button>
        <span className="tiny faint kb-size">{(section.content.length / 1000).toFixed(1)} mil</span>
        <select
          className="input kb-mode"
          value={section.mode}
          disabled={pending}
          aria-label={`Modo da seção ${section.title}`}
          onChange={(e) => {
            const mode = e.target.value as KnowledgeMode;
            startTransition(() => setSectionMode(section.id, mode));
          }}
        >
          {(Object.keys(MODE_LABEL) as KnowledgeMode[]).map((m) => (
            <option key={m} value={m}>
              {MODE_LABEL[m]}
            </option>
          ))}
        </select>
      </div>
      {open && (
        <div className="stack kb-body" style={{ gap: 8 }}>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Título da seção" />
          <textarea className="textarea" rows={14} value={content} onChange={(e) => setContent(e.target.value)} style={{ resize: "vertical", fontSize: 13.5 }} />
          {error && <p className="error-text">{error}</p>}
          <div className="row" style={{ justifyContent: "space-between", gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={pending}
              onClick={() => {
                if (window.confirm(`Apagar a seção "${section.title}"?`)) startTransition(() => deleteSection(section.id));
              }}
            >
              <IconTrash size={15} /> Apagar
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!dirty || pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await updateSection(section.id, title, content);
                  setError(r.error ?? null);
                })
              }
            >
              {pending ? "Salvando…" : "Salvar texto"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
