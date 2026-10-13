"use client";

import { useState, useTransition } from "react";
import { IconRefresh } from "@/components/Icons";
import { refreshLeadPhotos } from "./actions";

// Busca as fotos de perfil de quem jÃ¡ estÃ¡ conectado no LinkedIn (consulta gratuita).
export function RefreshPhotosButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  function run() {
    setMessage(null);
    startTransition(async () => {
      const result = await refreshLeadPhotos();
      if (result.error) setMessage({ text: result.error, error: true });
      else if (!result.updated) setMessage({ text: "Nenhuma foto nova encontrada.", error: false });
      else setMessage({ text: result.updated === 1 ? "1 foto atualizada." : `${result.updated} fotos atualizadas.`, error: false });
    });
  }

  return (
    <div style={{ paddingTop: 12 }}>
      <button type="button" onClick={run} disabled={pending} className="btn-line btn-sm">
        <IconRefresh size={13} />
        {pending ? "Buscando fotosâ€¦" : "Atualizar fotos dos contatos"}
      </button>
      {message && (
        <p className={message.error ? "field-error" : "ok-text"} role="status" style={{ marginTop: 8 }}>
          {message.text}
        </p>
      )}
    </div>
  );
}
