"use client";

import { useState, useTransition } from "react";
import { testPick } from "./actions";

// Mostra quais temas "só quando o assunto aparecer" entrariam para uma pergunta de exemplo.
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
        aria-label="Pergunta de exemplo de um cliente"
        placeholder='Ex.: "O seguro cobre câncer? Tenho 2 filhos e sou dentista."'
      />
      <div className="form-actions">
        <button
          type="button"
          className="btn-line btn-sm"
          disabled={pending || !text.trim()}
          onClick={() => startTransition(async () => setResult(await testPick(text)))}
        >
          {pending ? "Consultando…" : "Ver temas escolhidos"}
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
            Nenhum tema extra: só os que ela sempre considera.
          </p>
        ))}
    </div>
  );
}
