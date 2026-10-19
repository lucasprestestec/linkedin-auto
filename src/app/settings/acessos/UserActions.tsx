"use client";

import { useState, useTransition } from "react";
import { inviteLink, setPanelUserActive } from "./actions";

export function UserActions({ id, active }: { id: string; active: boolean }) {
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  return (
    <div className="stack" style={{ gap: 6, alignItems: "flex-end" }}>
      <span className="row" style={{ gap: 4, flexWrap: "wrap" }}>
        {active && (
          <button
            type="button"
            className="btn-text"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await inviteLink(id);
                setError(r.error ?? null);
                setLink(r.link ?? null);
                setCopied(false);
              })
            }
          >
            Gerar link de senha
          </button>
        )}
        <button
          type="button"
          className="btn-text"
          disabled={pending}
          onClick={() => {
            if (!active || window.confirm("Desativar? A pessoa perde o acesso na próxima vez que abrir uma página.")) {
              start(async () => {
                const r = await setPanelUserActive(id, !active);
                setError(r.error ?? null);
              });
            }
          }}
        >
          {active ? "Desativar" : "Reativar"}
        </button>
      </span>
      {error && <span className="field-error">{error}</span>}
      {link && (
        <span className="stack" style={{ gap: 4, width: "100%" }}>
          <input className="field" readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Link de senha" />
          <button type="button" className="btn-line btn-sm" onClick={() => navigator.clipboard.writeText(link).then(() => setCopied(true), () => setCopied(false))}>
            {copied ? "Copiado" : "Copiar link"}
          </button>
          <small className="hint">Vale 7 dias e só uma vez. Envie só para a própria pessoa.</small>
        </span>
      )}
    </div>
  );
}
