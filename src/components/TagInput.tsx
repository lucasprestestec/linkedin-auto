"use client";

import { useId, useState } from "react";
import { IconPlus, IconX } from "./Icons";

// Campo de várias entradas: digite e aperte Enter (ou vírgula) pra virar uma
// etiqueta; o × tira. Sugestões aparecem como atalhos abaixo. É o bloco de
// qualquer filtro com mais de um valor (cargos, cidades, empresas...).
export function TagInput({
  values,
  onChange,
  placeholder,
  suggestions = [],
  label,
  max = 20,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  suggestions?: string[];
  label: string;
  max?: number;
}) {
  const [draft, setDraft] = useState("");
  const id = useId();

  function add(raw: string) {
    const value = raw.trim().replace(/\s+/g, " ");
    setDraft("");
    if (!value || values.length >= max) return;
    if (values.some((v) => v.toLowerCase() === value.toLowerCase())) return;
    onChange([...values, value]);
  }

  function remove(value: string) {
    onChange(values.filter((v) => v !== value));
  }

  const pending = suggestions.filter((s) => !values.some((v) => v.toLowerCase() === s.toLowerCase())).slice(0, 6);

  return (
    <div className="tag-input">
      <label htmlFor={id} className="tag-box">
        {values.map((v) => (
          <span key={v} className="tag-pill">
            {v}
            <button type="button" onClick={() => remove(v)} aria-label={`Remover ${v}`}>
              <IconX size={12} strokeWidth={2.6} />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => {
            // Colou "a, b, c": vira três etiquetas de uma vez.
            const text = e.target.value;
            if (text.includes(",")) {
              const parts = text.split(",");
              const last = parts.pop() ?? "";
              let next = [...values];
              for (const p of parts) {
                const v = p.trim();
                if (v && !next.some((x) => x.toLowerCase() === v.toLowerCase())) next = [...next, v];
              }
              onChange(next.slice(0, max));
              setDraft(last);
            } else setDraft(text);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && values.length) {
              remove(values[values.length - 1]);
            }
          }}
          onBlur={() => draft.trim() && add(draft)}
          placeholder={values.length ? "Adicionar outro…" : placeholder}
          aria-label={label}
          enterKeyHint="done"
        />
      </label>
      {pending.length > 0 && (
        <div className="tag-suggestions">
          {pending.map((s) => (
            <button key={s} type="button" onClick={() => add(s)}>
              <IconPlus size={12} strokeWidth={2.6} /> {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
