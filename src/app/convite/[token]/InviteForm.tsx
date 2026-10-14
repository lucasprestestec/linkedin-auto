"use client";

import { useActionState } from "react";
import { acceptInvite } from "./actions";

export function InviteForm({ token, name, min }: { token: string; name: string; min: number }) {
  const [state, formAction, pending] = useActionState(acceptInvite.bind(null, token), undefined);

  return (
    <main className="solo">
      <form action={formAction} className="solo-form">
        <h1 className="t-title">Olá, {name.split(/\s+/)[0]}</h1>
        <p className="t-sub">Escolha a sua senha de acesso à Central Dors (pelo menos {min} caracteres).</p>
        <input className="field" type="password" name="password" placeholder="Nova senha" aria-label="Nova senha" autoComplete="new-password" minLength={min} autoFocus required />
        <input className="field" type="password" name="again" placeholder="Repita a senha" aria-label="Repita a senha" autoComplete="new-password" minLength={min} required />
        {state?.error && <p className="field-error">{state.error}</p>}
        <button type="submit" disabled={pending} className="btn-solid">
          {pending ? "Salvando…" : "Salvar e entrar"}
        </button>
      </form>
    </main>
  );
}
