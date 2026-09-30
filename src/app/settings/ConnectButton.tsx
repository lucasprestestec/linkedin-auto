"use client";

import { useState, useTransition } from "react";
import { getOrCreateIdentityLoginLink } from "./actions";

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
        setError(err instanceof Error ? err.message : "Não foi possível gerar o link de conexão.");
      }
    });
  }

  return (
    <div className="stack" style={{ gap: 8, alignItems: "flex-start" }}>
      <button type="button" onClick={() => handleClick()} disabled={pending} className="btn-solid">
        {pending ? "Gerando link…" : "Conectar o LinkedIn"}
      </button>
      <p className="hint" style={{ margin: 0 }}>
        Abre em outra aba. Depois de entrar, volte aqui.
      </p>
      {opened && (
        <button type="button" className="btn-text" onClick={() => handleClick(true)} disabled={pending}>
          O link não abriu? Gerar outro
        </button>
      )}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
