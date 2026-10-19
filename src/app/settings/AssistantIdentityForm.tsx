"use client";

import { useActionState, useState } from "react";
import { updateAssistantIdentity } from "./actions";

// Com nome, a IA fala como uma assistente própria ("Helena, da área de novos
// negócios") e nunca se passa pelo corretor. Sem nome, escreve como o corretor.
export function AssistantIdentityForm({ name, discloseAi }: { name: string; discloseAi: boolean }) {
  const [state, formAction, pending] = useActionState(updateAssistantIdentity, undefined);
  const [value, setValue] = useState(name);
  const [disclose, setDisclose] = useState(discloseAi);
  const dirty = value.trim() !== name.trim() || disclose !== discloseAi;

  return (
    <form action={formAction} className="stack" style={{ gap: 4 }}>
      <div className="setting" style={{ padding: "8px 0" }}>
        <label htmlFor="assistantName" className="setting-text">
          <b>Nome da assistente</b>
          <small>vazio = a IA escreve como o corretor</small>
        </label>
        <input
          id="assistantName"
          name="assistantName"
          className="field"
          style={{ maxWidth: 180 }}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ex.: Helena"
          autoComplete="off"
        />
      </div>
      <div className="setting" style={{ padding: "8px 0" }}>
        <span className="setting-text">
          <b>Pode confirmar que é assistente virtual</b>
          <small>se perguntarem &quot;é robô?&quot;, ela confirma e segue; desligado, passa pra você</small>
        </span>
        <input type="hidden" name="assistantDiscloseAi" value={disclose ? "on" : ""} />
        <button
          type="button"
          role="switch"
          aria-checked={disclose}
          aria-label="Pode confirmar que é assistente virtual"
          className="switch"
          onClick={() => setDisclose((d) => !d)}
        />
      </div>
      {(dirty || state?.saved) && (
        <div className="form-actions">
          {dirty ? (
            <button type="submit" className="btn-solid btn-sm" disabled={pending}>
              {pending ? "Salvando…" : "Salvar"}
            </button>
          ) : (
            <span className="ok-text">Salvo</span>
          )}
        </div>
      )}
    </form>
  );
}
