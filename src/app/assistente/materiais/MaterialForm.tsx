"use client";

import { startTransition, useActionState } from "react";
import { ACCEPT_ATTR, TYPES_LABEL } from "@/lib/materials";
import { addMaterial } from "./actions";

export function MaterialForm() {
  const [state, action, pending] = useActionState(addMaterial, undefined);

  return (
    <form
      className="form"
      style={{ gap: 12 }}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
    >
      <label>
        <span className="label">Nome</span>
        <input className="field" name="title" maxLength={80} placeholder="Ex.: Tabela de planos de saúde 2026" required />
      </label>
      <label>
        <span className="label">Quando usar (opcional)</span>
        <input className="field" name="whenToUse" maxLength={200} placeholder="Ex.: para quem pergunta de preço de saúde empresarial" />
      </label>
      <label>
        <span className="label">Arquivo ({TYPES_LABEL}; até 4 MB)</span>
        <input className="field" type="file" name="file" accept={ACCEPT_ATTR} />
      </label>
      <label>
        <span className="label">ou um link (Drive, YouTube, site)</span>
        <input className="field" name="link" inputMode="url" placeholder="https://" />
      </label>
      <div className="form-actions">
        <button type="submit" className="btn-solid btn-sm" disabled={pending}>
          {pending ? "Guardando…" : "Guardar material"}
        </button>
        {state?.error && <span className="field-error">{state.error}</span>}
        {state?.ok && !pending && <span className="ok-text">{state.ok}</span>}
      </div>
    </form>
  );
}
