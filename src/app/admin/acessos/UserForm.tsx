"use client";

import { useState, useTransition } from "react";
import { addPanelUser } from "./actions";

export function UserForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="stack"
      style={{ gap: 8 }}
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await addPanelUser({ name, email });
          if (r.error) setError(r.error);
          else {
            setName("");
            setEmail("");
          }
        });
      }}
    >
      <h2 className="t-label">Dar acesso a mais uma pessoa</h2>
      <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome (ex.: Maria Eduarda)" aria-label="Nome" required />
      <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail da pessoa" aria-label="E-mail" required />
      {error && <p className="field-error">{error}</p>}
      <div className="form-actions">
        <button type="submit" className="btn-solid btn-sm" disabled={pending}>
          {pending ? "Salvando…" : "Cadastrar"}
        </button>
      </div>
    </form>
  );
}
