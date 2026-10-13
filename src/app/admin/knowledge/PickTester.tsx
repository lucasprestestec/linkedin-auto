"use client";

import { useState, useTransition } from "react";
import { testPick } from "./actions";

// Mostra quais seções "sob demanda" entrariam para uma mensagem
// de exemplo — pra conferir se a escolha faz sentido antes de ir ao ar.
export function PickTester() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ titles?: string[]; error?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="card card-pad stack" style={{ gap: 10 }}>
      <textarea
        className="textarea"
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder='Ex.: "O seguro cobre câncer? Tenho 2 filhos e sou dentista."'
        style={{ resize: "vertical" }}
      />
      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={pending || !text.trim()}
          onClick={() => startTransition(async () => setResult(await testPick(text)))}
        >
          {pending ? "Consultando…" : "Ver seções escolhidas"}
        </button>
      </div>
      {result?.error && <p className="error-text">{result.error}</p>}
      {result?.titles &&
        (result.titles.length ? (
          <ul className="kb-picks">
            {result.titles.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        ) : (
          <p className="tiny faint">Nenhuma seção extra: só o núcleo (&quot;Sempre&quot;) entraria.</p>
        ))}
    </div>
  );
}
