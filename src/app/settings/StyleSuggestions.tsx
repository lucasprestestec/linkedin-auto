"use client";

import { useState, useTransition } from "react";
import type { Suggestion } from "@/lib/styleSuggestions";
import { acceptStyleSuggestion, dismissStyleSuggestion } from "./style-actions";

// Regras que o assistente sugere depois de ver o que você corrigiu. Nada entra sem o seu OK.
export function StyleSuggestions({ items }: { items: Suggestion[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (items.length === 0) return null;

  function run(fn: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (r.error) setError(r.error);
    });
  }

  return (
    <div className="note stack" style={{ gap: 12 }}>
      <b className="small">Sugestões do assistente</b>
      {items.map((s) => (
        <div key={s.key} className="stack" style={{ gap: 6 }}>
          <p style={{ margin: 0 }}>
            <b>{s.text}</b>
            <br />
            <span className="small muted">{s.evidence}</span>
          </p>
          <div className="row wrap" style={{ gap: 8 }}>
            <button type="button" className="btn-solid btn-sm" disabled={pending} onClick={() => run(() => acceptStyleSuggestion(s.key))}>
              Adicionar como regra
            </button>
            <button type="button" className="btn-line btn-sm" disabled={pending} onClick={() => run(() => dismissStyleSuggestion(s.key))}>
              Dispensar
            </button>
          </div>
        </div>
      ))}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
