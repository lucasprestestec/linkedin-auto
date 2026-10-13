"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { Suggestion } from "@/lib/styleSuggestions";
import { describeStyle, type WritingStyle } from "@/lib/writingStyle";
import { ClosedQuestions } from "@/app/calibrar/ClosedQuestions";
import { StyleAdjustments } from "@/app/calibrar/StyleAdjustments";
import { saveCalibration } from "./style-actions";
import { StyleSuggestions } from "./StyleSuggestions";
import { WritingStyleForm } from "./WritingStyleForm";

function Sub({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <details className="fold">
      <summary>
        <span className="setting-text">
          <b>{title}</b>
          <small>{hint}</small>
        </span>
      </summary>
      <div className="fold-body">{children}</div>
    </details>
  );
}

// "Meu jeito de escrever", depois da calibragem: o perfil em palavras, o botão pra calibrar de novo,
// a caixa "Sugerir mudanças" e os ajustes finos.
export function StyleOverview({ style, suggestions }: { style: WritingStyle; suggestions: Suggestion[] }) {
  const [local, setLocal] = useState(style);
  const [pending, startTransition] = useTransition();
  const rows = describeStyle(local);
  const started = rows.length > 0 || Object.keys(local.answers).length > 0 || local.rules.length > 0;

  function quick(id: string, value: string) {
    setLocal((prev) => ({ ...prev, [id]: value }));
    startTransition(async () => {
      const r = await saveCalibration({ [id]: value } as never);
      if (r.style) setLocal(r.style);
    });
  }

  return (
    <div className="stack" style={{ gap: 18 }}>
      {!local.calibratedAt ? (
        <div className="note stack" style={{ gap: 10 }}>
          <b>{started ? "Falta terminar a calibragem" : "Calibre o assistente para ele escrever como você"}</b>
          <span>
            {started
              ? "Você começou, mas ainda não concluiu. Continue de onde parou."
              : "Em uns 8 minutos você responde algumas perguntas e situações reais, e o assistente aprende o seu jeito de falar."}
          </span>
          <div>
            <Link href="/calibrar" className="btn-solid btn-sm">
              {started ? "Continuar calibragem" : "Começar calibragem"}
            </Link>
          </div>
        </div>
      ) : (
        <div className="stack" style={{ gap: 10 }}>
          {rows.length > 0 ? (
            <div className="stack" style={{ gap: 4 }}>
              {rows.map((r) => (
                <p key={r.label} style={{ margin: 0 }}>
                  <b>{r.label}:</b> {r.value}
                </p>
              ))}
            </div>
          ) : (
            <p className="muted">Nenhuma resposta direta guardada ainda.</p>
          )}
          {Object.keys(local.answers).length > 0 && (
            <p className="small muted" style={{ margin: 0 }}>
              {Object.keys(local.answers).length} situação(ões) respondida(s) com as suas palavras.
            </p>
          )}
          <div>
            <Link href="/calibrar" className="btn-line btn-sm">
              Refazer calibragem
            </Link>
          </div>
        </div>
      )}

      <StyleSuggestions items={suggestions} />

      <StyleAdjustments key={style.rules.join("|")} initialRules={style.rules} />

      <Sub title="Ajustes rápidos" hint="Mudar uma resposta da calibragem sem refazer tudo">
        <ClosedQuestions style={local} disabled={pending} onChange={quick} />
      </Sub>
      <Sub title="Editar à mão" hint="Ajustes por extenso e mensagens suas coladas (avançado)">
        <WritingStyleForm value={style} />
      </Sub>
    </div>
  );
}
