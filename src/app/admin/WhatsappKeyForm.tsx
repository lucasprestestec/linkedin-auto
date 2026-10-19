"use client";

import { useActionState, useState, useTransition } from "react";
import { removeWhatsappKey, saveWhatsappKey } from "./actions";

// A chave do CRM de WhatsApp deste cliente. Cole uma vez: ela é testada, guardada cifrada no banco
// e nunca mais aparece. O cliente só lê o QR Code em Ajustes.
export function WhatsappKeyForm({ hasKey, fromServer }: { hasKey: boolean; fromServer: boolean }) {
  const [state, formAction, pending] = useActionState(saveWhatsappKey, undefined);
  const [removing, startRemove] = useTransition();
  const [token, setToken] = useState("");

  return (
    <form
      action={(fd) => {
        formAction(fd);
        setToken("");
      }}
      className="stack"
      style={{ gap: 8 }}
    >
      <p className="hint">
        {fromServer
          ? "A chave vem de uma variável do servidor (DESKCOMM_TOKEN) e vale mais que a daqui."
          : hasKey
            ? "Chave guardada. Cole outra para trocar."
            : "Nenhuma chave guardada: o cliente vê “ainda não preparado” em Ajustes."}
      </p>
      <input
        name="token"
        type="password"
        className="field"
        style={{ maxWidth: 420 }}
        autoComplete="new-password"
        data-1p-ignore
        data-lpignore="true"
        placeholder="Cole a chave de acesso (dsk_…)"
        value={token}
        onChange={(e) => setToken(e.target.value)}
      />
      {state?.error && <p className="field-error">{state.error}</p>}
      {state?.saved && <p className="ok-text">Chave testada e guardada.</p>}
      <div className="form-actions">
        <button type="submit" className="btn-solid btn-sm" disabled={pending || !token.trim()}>
          {pending ? "Testando…" : "Testar e guardar"}
        </button>
        {hasKey && (
          <button type="button" className="btn-line btn-sm btn-danger-line" disabled={removing} onClick={() => startRemove(() => removeWhatsappKey())}>
            {removing ? "Removendo…" : "Remover chave"}
          </button>
        )}
      </div>
    </form>
  );
}
