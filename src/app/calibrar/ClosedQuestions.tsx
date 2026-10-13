"use client";

import { CLOSED_QUESTIONS } from "@/lib/calibrationData";
import type { WritingStyle } from "@/lib/writingStyle";

// As perguntas de múltipla escolha da calibragem. Usada na calibragem e nos "ajustes rápidos" da
// tela de configurações. Tocar de novo na opção marcada desmarca.
export function ClosedQuestions({
  style,
  disabled,
  onChange,
}: {
  style: WritingStyle;
  disabled?: boolean;
  onChange: (id: (typeof CLOSED_QUESTIONS)[number]["id"], value: string) => void;
}) {
  return (
    <div className="stack" style={{ gap: 18 }}>
      {CLOSED_QUESTIONS.map((q) => (
        <div key={q.id} className="stack" style={{ gap: 8 }}>
          <span className="label">{q.title}</span>
          <div className="tabs" role="group" aria-label={q.title} style={{ flexWrap: "wrap" }}>
            {q.options.map((o) => (
              <button
                key={o.value}
                type="button"
                aria-pressed={style[q.id] === o.value}
                disabled={disabled}
                onClick={() => onChange(q.id, style[q.id] === o.value ? "auto" : o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
