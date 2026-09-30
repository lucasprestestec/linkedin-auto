"use client";

import { useActionState, useState } from "react";
import { initials } from "@/lib/format";
import { updateOwnerName } from "./actions";

// Nome do corretor: aparece na saudação ("Bom dia, Lucas") e no menu.
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
            Seu nome
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
          />
        </div>
      </div>
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
