"use client";

import { useState, useTransition } from "react";
import { getOrCreateIdentityLoginLink } from "./actions";
import { IconAlert, IconLinkedin } from "@/components/Icons";

export function ConnectButton() {
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleClick(fresh = false) {
    setError(null);
    startTransition(async () => {
      try {
        const link = await getOrCreateIdentityLoginLink(fresh);
        setOpened(true);
        window.open(link, "_blank", "noopener,noreferrer");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao gerar link de conexão.");
      }
    });
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      <button onClick={() => handleClick()} disabled={pending} className="btn btn-block" style={{ background: "#0a66c2", color: "#fff" }}>
        {pending ? (
          <>
            <span className="spinner" /> Gerando link…
          </>
        ) : (
          <>
            <IconLinkedin size={18} /> Conectar com LinkedIn
          </>
        )}
      </button>
      <p className="hint" style={{ textAlign: "center" }}>
        Abre em uma nova aba. Depois de entrar, volte aqui.
      </p>
      {opened && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleClick(true)} disabled={pending} style={{ alignSelf: "center" }}>
          O link não abriu ou expirou? Gerar um novo
        </button>
      )}
      {error && (
        <p className="error-text">
          <IconAlert size={15} /> {error}
        </p>
      )}
    </div>
  );
}
