"use client";

import { useActionState } from "react";
import { adminLogin } from "./actions";

export function AdminLogin() {
  const [state, formAction, pending] = useActionState(adminLogin, undefined);
  return (
    <form action={formAction} className="card" style={{ maxWidth: 420 }}>
      <div className="setting-text">
        <b>Área restrita</b>
        <small>Senha de administrador (ADMIN_PASSWORD)</small>
      </div>
      <input name="password" type="password" className="field" placeholder="Senha do admin" aria-label="Senha do admin" autoFocus required />
      {state?.error && <p className="field-error">{state.error}</p>}
      <button type="submit" className="btn-solid" disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
