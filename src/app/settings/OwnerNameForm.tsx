"use client";

import { useActionState, useState } from "react";
import { IconCheck } from "@/components/Icons";
import { initials, avatarGradient } from "@/lib/format";
import { updateOwnerName } from "./actions";

// Nome do corretor: aparece na saudação ("Boa noite, Lucas.") e no menu.
export function OwnerNameForm({ value }: { value: string }) {
  const [state, formAction, pending] = useActionState(updateOwnerName, undefined);
  const [name, setName] = useState(value);
  const dirty = name.trim() !== value.trim();
  const [first, ...rest] = (name.trim() || "Você").split(/\s+/);

  return (
    <form action={formAction} className="card card-pad row owner-card" style={{ gap: 16 }}>
      <span className="avatar" style={{ width: 60, height: 60, background: avatarGradient(name.trim() || "Você"), fontSize: 21, flexShrink: 0 }}>
        {initials(first, rest.at(-1))}
      </span>
      <div className="stack" style={{ flex: 1, minWidth: 0, gap: 6 }}>
        <label htmlFor="owner-name" className="label">
          Seu nome
        </label>
        <div className="row" style={{ gap: 8 }}>
          <input
            id="owner-name"
            name="ownerName"
            className="input"
            style={{ height: 46, fontSize: 16 }}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Lucas Almeida"
            autoComplete="name"
            maxLength={60}
          />
          {dirty ? (
            <button type="submit" className="btn btn-primary btn-sm" disabled={pending} style={{ height: 46 }}>
              {pending ? "Salvando…" : "Salvar"}
            </button>
          ) : (
            state?.saved && (
              <span className="success-text" style={{ flexShrink: 0 }}>
                <IconCheck size={15} strokeWidth={3} /> Salvo
              </span>
            )
          )}
        </div>
        <span className="tiny faint">Usado na saudação da tela inicial e no menu.</span>
      </div>
    </form>
  );
}
