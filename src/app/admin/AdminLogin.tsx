"use client";

import { useActionState } from "react";
import { IconAlert, IconLock } from "@/components/Icons";
import { adminLogin } from "./actions";

export function AdminLogin() {
  const [state, formAction, pending] = useActionState(adminLogin, undefined);
  return (
    <form action={formAction} className="card card-pad stack" style={{ gap: 14, maxWidth: 420 }}>
      <div className="row" style={{ gap: 12 }}>
        <span className="setting-icon" style={{ background: "var(--ink)", color: "var(--bg)" }}>
          <IconLock size={19} />
        </span>
        <div className="stack">
          <strong>Área restrita</strong>
          <span className="tiny faint">Senha de administrador (ADMIN_PASSWORD)</span>
        </div>
      </div>
      <input name="password" type="password" className="input" placeholder="Senha do admin" aria-label="Senha do admin" autoFocus required />
      {state?.error && (
        <p className="error-text">
          <IconAlert size={15} /> {state.error}
        </p>
      )}
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
