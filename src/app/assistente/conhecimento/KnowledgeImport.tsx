"use client";

import { startTransition, useActionState } from "react";
import { importKnowledge, type ImportState } from "./actions";

export function KnowledgeImport({ hasSections }: { hasSections: boolean }) {
  const [state, action, pending] = useActionState<ImportState, FormData>(importKnowledge, undefined);

  return (
    <form
      className="form"
      style={{ gap: 12 }}
      onSubmit={(e) => {
        e.preventDefault();
        if (hasSections && !window.confirm("Substituir a base atual? As seções e os modos escolhidos serão trocados pelos do arquivo novo.")) return;
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
    >
      <label>
        <span className="label">Arquivo (.md ou .txt)</span>
        <input type="file" name="file" accept=".md,.markdown,.txt,text/markdown,text/plain" className="field" />
      </label>
      <label>
        <span className="label">ou cole o texto</span>
        <textarea name="markdown" className="field" rows={5} placeholder={"# 1. Quem é a assistente\n...\n# 2. Produtos\n..."} />
      </label>
      <p className="hint" style={{ margin: 0 }}>
        Títulos com &quot;# &quot; viram seções; índice, fontes e pendências já vêm desligados.
      </p>
      <div className="form-actions">
        <button type="submit" className="btn-solid btn-sm" disabled={pending}>
          {pending ? "Importando…" : hasSections ? "Substituir" : "Importar"}
        </button>
        {state?.error && <span className="field-error">{state.error}</span>}
        {state?.imported && <span className="ok-text">{state.imported} seções importadas. Confira os modos.</span>}
      </div>
    </form>
  );
}
