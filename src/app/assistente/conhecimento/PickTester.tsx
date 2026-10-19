"use client";

import { useState, useTransition } from "react";
import { testPick } from "./actions";

// Mostra quais seções "sob demanda" entrariam para uma mensagem de exemplo —
// pra conferir se a escolha faz sentido antes de ir ao ar.
export function PickTester() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ titles?: string[]; error?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="form" style={{ gap: 10 }}>
      <textarea
        className="field"
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label="Mensagem de exemplo do lead"
        placeholder='Ex.: "O seguro cobre câncer? Tenho 2 filhos e sou dentista."'
      />
      <div className="form-actions">
        <button
          type="button"
          className="btn-line btn-sm"
          disabled={pending || !text.trim()}
          onClick={() => startTransition(async () => setResult(await testPick(text)))}
        >
          {pending ? "Consultando…" : "Ver seções escolhidas"}
        </button>
        {result?.error && <span className="field-error">{result.error}</span>}
      </div>
      {result?.titles &&
        (result.titles.length ? (
          <ul className="know-picks">
            {result.titles.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        ) : (
          <p className="hint" style={{ margin: 0 }}>
            Nenhuma seção extra: só o núcleo (&quot;Sempre&quot;) entraria.
          </p>
        ))}
    </div>
  );
}
