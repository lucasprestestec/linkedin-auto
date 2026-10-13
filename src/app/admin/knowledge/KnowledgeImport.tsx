"use client";

import { startTransition, useActionState, useRef } from "react";
import { importKnowledge, type ImportState } from "./actions";
import { IconCheck, IconFileText } from "@/components/Icons";

export function KnowledgeImport({ hasSections }: { hasSections: boolean }) {
  const [state, action, pending] = useActionState<ImportState, FormData>(importKnowledge, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      className="card card-pad stack"
      style={{ gap: 12 }}
      onSubmit={(e) => {
        e.preventDefault();
        if (hasSections && !window.confirm("Substituir a base atual? As seções e os modos escolhidos serão trocados pelos do arquivo novo.")) return;
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
    >
      <label className="field" style={{ gap: 6 }}>
        <span className="label">
          <IconFileText size={15} /> Arquivo (.md ou .txt)
        </span>
        <input type="file" name="file" accept=".md,.markdown,.txt,text/markdown,text/plain" className="input" />
      </label>
      <label className="field" style={{ gap: 6 }}>
        <span className="label">ou cole o texto</span>
        <textarea name="markdown" className="textarea" rows={5} placeholder={"# 1. Quem é a assistente\n...\n# 2. Produtos\n..."} style={{ resize: "vertical" }} />
      </label>
      <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
        <span className="tiny faint">Títulos com &quot;# &quot; viram seções; índice, fontes e pendências já vêm desligados.</span>
        <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
          {pending ? "Importando…" : hasSections ? "Substituir" : "Importar"}
        </button>
      </div>
      {state?.error && <p className="error-text">{state.error}</p>}
      {state?.imported && (
        <p className="success-text">
          <IconCheck size={15} strokeWidth={3} /> {state.imported} seções importadas. Confira os modos ao lado.
        </p>
      )}
    </form>
  );
}
