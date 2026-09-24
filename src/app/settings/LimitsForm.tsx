"use client";

import { useActionState, useState } from "react";
import { updateLimits } from "./actions";
import { IconCheck, IconMail, IconMinus, IconPlus, IconShield, IconUserPlus } from "@/components/Icons";

function Stepper({ id, name, value, min, max, onChange }: { id: string; name: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <div className="stepper">
      <button type="button" onClick={() => onChange(clamp(value - 1))} disabled={value <= min} aria-label="Diminuir">
        <IconMinus size={16} strokeWidth={2.6} />
      </button>
      <input
        id={id}
        name={name}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value) || min))}
      />
      <button type="button" onClick={() => onChange(clamp(value + 1))} disabled={value >= max} aria-label="Aumentar">
        <IconPlus size={16} strokeWidth={2.6} />
      </button>
    </div>
  );
}

export function LimitsForm({ dailyInviteLimit, dailyMessageLimit }: { dailyInviteLimit: number; dailyMessageLimit: number }) {
  const [state, formAction, pending] = useActionState(updateLimits, undefined);
  const [invites, setInvites] = useState(dailyInviteLimit);
  const [messages, setMessages] = useState(dailyMessageLimit);
  const dirty = invites !== dailyInviteLimit || messages !== dailyMessageLimit;

  return (
    <form action={formAction} className="card" style={{ overflow: "hidden" }}>
      <div className="setting-row">
        <span className="setting-icon" style={{ background: "var(--brand-soft)", color: "var(--brand-ink)" }}>
          <IconUserPlus size={19} />
        </span>
        <label htmlFor="dailyInviteLimit" style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontWeight: 700 }}>Convites</span>
          <span className="tiny faint">por dia · máx. 50</span>
        </label>
        <Stepper id="dailyInviteLimit" name="dailyInviteLimit" value={invites} min={1} max={50} onChange={setInvites} />
      </div>
      <div className="setting-row">
        <span className="setting-icon" style={{ background: "var(--info-soft)", color: "var(--info-ink)" }}>
          <IconMail size={19} />
        </span>
        <label htmlFor="dailyMessageLimit" style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontWeight: 700 }}>Mensagens</span>
          <span className="tiny faint">por dia · máx. 80</span>
        </label>
        <Stepper id="dailyMessageLimit" name="dailyMessageLimit" value={messages} min={1} max={80} onChange={setMessages} />
      </div>
      <div className="setting-row" style={{ alignItems: "flex-start", background: "var(--surface-2)" }}>
        <IconShield size={18} style={{ color: "var(--success-ink)", flexShrink: 0, marginTop: 1 }} />
        <p className="tiny muted" style={{ lineHeight: 1.5 }}>
          Mandar convite ou mensagem demais é o principal motivo de restrição de conta. Sem Sales Navigator, o LinkedIn aceita
          no máximo ~25–30 convites por dia — acima disso eles são recusados.
        </p>
      </div>
      {(dirty || state?.saved || state?.error) && (
        <div className="setting-row" style={{ justifyContent: "flex-end", gap: 12 }}>
          {state?.error && <span className="error-text">{state.error}</span>}
          {!dirty && state?.saved && (
            <span className="success-text">
              <IconCheck size={15} strokeWidth={3} /> Salvo
            </span>
          )}
          {dirty && (
            <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
              {pending ? "Salvando…" : "Salvar limites"}
            </button>
          )}
        </div>
      )}
    </form>
  );
}
