"use client";

import { useActionState, useState } from "react";
import { initials } from "@/lib/format";
import { updateOwnerName } from "./actions";

// Nome do corretor. Obrigatório: é o nome com que o assistente se apresenta aos leads (e também aparece
// na saudação e no menu). Sem ele o assistente não liga nem responde.
export function OwnerNameForm({ value }: { value: string }) {
  const [state, formAction, pending] = useActionState(updateOwnerName, undefined);
  const [name, setName] = useState(value);
  const dirty = name.trim() !== value.trim();
  const [first, ...rest] = (name.trim() || "Você").split(/\s+/);

  return (
    <form action={formAction} className="card">
      <div className="row" style={{ gap: 14 }}>
        <span className="avatar" style={{ width: 56, height: 56, fontSize: 20 }}>
          {initials(first, rest.at(-1))}
        </span>
        <div className="grow">
          <label htmlFor="owner-name" className="label">
            Seu nome (obrigatório)
          </label>
          <input
            id="owner-name"
            name="ownerName"
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Lucas Almeida"
            autoComplete="name"
            maxLength={60}
            required
            aria-describedby="owner-name-hint"
          />
        </div>
      </div>
      <p id="owner-name-hint" className="hint" style={{ margin: "8px 0 0" }}>
        <b>É assim que o assistente vai se apresentar</b> nas conversas (&ldquo;Aqui é {name.trim() || "o seu nome"}…&rdquo;) e é o nome que ele responde se perguntarem quem está falando. Escreva como você quer ser chamado pelos clientes. Sem esse nome o assistente não liga.
      </p>
      {state && "error" in state && state.error && (
        <p className="field-error" role="alert">
          {state.error}
        </p>
      )}
      {(dirty || state?.saved) && (
        <div className="form-actions">
          {dirty ? (
            <button type="submit" className="btn-solid btn-sm" disabled={pending}>
              {pending ? "Salvando…" : "Salvar"}
            </button>
          ) : (
            <span className="ok-text">Salvo</span>
          )}
        </div>
      )}
    </form>
  );
}
