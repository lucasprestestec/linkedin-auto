"use client";

import { useActionState } from "react";
import { login } from "./actions";

export function LoginForm({ individual }: { individual: boolean }) {
  const [state, formAction, pending] = useActionState(login, undefined);

  return (
    <main className="solo">
      <form action={formAction} className="solo-form">
        <h1 className="t-title">Entrar</h1>
        {individual && (
          <input className="field" type="text" name="login" placeholder="Seu login (ex.: maria)" aria-label="Login" autoComplete="username" autoCapitalize="none" autoCorrect="off" autoFocus required />
        )}
        <input
          className="field"
          type="password"
          name="password"
          placeholder="Senha"
          aria-label="Senha"
          autoComplete="current-password"
          autoFocus={!individual}
          required
          aria-invalid={state?.error ? true : undefined}
        />
        {state?.error && <p className="field-error">{state.error}</p>}
        <button type="submit" disabled={pending} className="btn-solid">
          {pending ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
