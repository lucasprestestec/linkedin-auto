"use client";

import { useActionState, useState } from "react";
import { updateLimits } from "./actions";
import { Stepper } from "@/components/Stepper";

export function LimitsForm({ dailyInviteLimit, dailyMessageLimit }: { dailyInviteLimit: number; dailyMessageLimit: number }) {
  const [state, formAction, pending] = useActionState(updateLimits, undefined);
  const [invites, setInvites] = useState(dailyInviteLimit);
  const [messages, setMessages] = useState(dailyMessageLimit);
  const dirty = invites !== dailyInviteLimit || messages !== dailyMessageLimit;

  return (
    <form action={formAction} className="stack" style={{ gap: 4 }}>
      <div className="setting" style={{ padding: "8px 0" }}>
        <label htmlFor="dailyInviteLimit" className="setting-text">
          <b>Convites</b>
          <small>por dia, no máximo 50</small>
        </label>
        <Stepper id="dailyInviteLimit" name="dailyInviteLimit" value={invites} min={1} max={50} onChange={setInvites} />
      </div>
      <div className="setting" style={{ padding: "8px 0" }}>
        <label htmlFor="dailyMessageLimit" className="setting-text">
          <b>Mensagens</b>
          <small>por dia, no máximo 80</small>
        </label>
        <Stepper id="dailyMessageLimit" name="dailyMessageLimit" value={messages} min={1} max={80} onChange={setMessages} />
      </div>
      <p className="hint">
        Convite ou mensagem demais é o principal motivo de restrição de conta. Sem Sales Navigator, o LinkedIn aceita no máximo cerca de 25 a 30 convites por
        dia; acima disso eles são recusados.
      </p>
      {(dirty || state?.saved || state?.error) && (
        <div className="form-actions">
          {dirty && (
            <button type="submit" className="btn-solid btn-sm" disabled={pending}>
              {pending ? "Salvando…" : "Salvar limites"}
            </button>
          )}
          {!dirty && state?.saved && <span className="ok-text">Salvo</span>}
          {state?.error && <span className="field-error">{state.error}</span>}
        </div>
      )}
    </form>
  );
}
