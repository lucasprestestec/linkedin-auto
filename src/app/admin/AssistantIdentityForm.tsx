"use client";

import { useActionState, useState } from "react";
import { updateAssistantIdentity } from "./actions";
import { IconCheck, IconUser } from "@/components/Icons";

// Com nome, a IA fala como uma assistente própria ("Helena, da área de novos
// negócios") e nunca se passa pelo corretor. Sem nome, escreve como o corretor.
export function AssistantIdentityForm({ name, discloseAi }: { name: string; discloseAi: boolean }) {
  const [state, formAction, pending] = useActionState(updateAssistantIdentity, undefined);
  const [value, setValue] = useState(name);
  const [disclose, setDisclose] = useState(discloseAi);
  const dirty = value.trim() !== name.trim() || disclose !== discloseAi;

  return (
    <form action={formAction} className="card" style={{ overflow: "hidden" }}>
      <div className="setting-row">
        <span className="setting-icon" style={{ background: "var(--brand-grad)", color: "#fff" }}>
          <IconUser size={19} />
        </span>
        <label htmlFor="assistantName" style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontWeight: 700 }}>Nome da assistente</span>
          <span className="tiny faint">vazio = a IA escreve como o corretor</span>
        </label>
        <input
          id="assistantName"
          name="assistantName"
          className="input"
          style={{ maxWidth: 160 }}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ex.: Helena"
          autoComplete="off"
        />
      </div>
      <label className="setting-row" style={{ cursor: "pointer" }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontWeight: 700 }}>Pode confirmar que é assistente virtual</span>
          <span className="tiny faint">se perguntarem &quot;é robô?&quot;, ela confirma e segue; desligado, passa pra você</span>
        </span>
        <input type="checkbox" name="assistantDiscloseAi" checked={disclose} onChange={(e) => setDisclose(e.target.checked)} className="sr-only" />
        <span className="switch switch-light" role="switch" aria-checked={disclose} aria-hidden="true" />
      </label>
      {(dirty || state?.saved) && (
        <div className="setting-row" style={{ justifyContent: "flex-end", gap: 12 }}>
          {!dirty && state?.saved ? (
            <span className="success-text">
              <IconCheck size={15} strokeWidth={3} /> Salvo
            </span>
          ) : (
            <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
              {pending ? "Salvando…" : "Salvar"}
            </button>
          )}
        </div>
      )}
    </form>
  );
}
