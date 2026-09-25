"use client";

import { useActionState, useState } from "react";
import { updateFollowUp } from "./actions";
import { IconCheck, IconClock, IconRefresh, IconSparkles } from "@/components/Icons";
import { Stepper } from "@/components/Stepper";
import { FOLLOW_UP_DELAY_HOURS_RANGE, FOLLOW_UP_DELAY_STEP_HOURS, FOLLOW_UP_MAX_COUNT_RANGE } from "@/lib/settings-ranges";

function formatDelay(hours: number): string {
  if (hours % 24 === 0) {
    const days = hours / 24;
    return `${days} dia${days > 1 ? "s" : ""}`;
  }
  return `${hours}h`;
}

export function FollowUpForm({ followUpMaxCount, followUpDelayHours }: { followUpMaxCount: number; followUpDelayHours: number }) {
  const [state, formAction, pending] = useActionState(updateFollowUp, undefined);
  const [count, setCount] = useState(followUpMaxCount);
  const [hours, setHours] = useState(followUpDelayHours);
  const dirty = count !== followUpMaxCount || hours !== followUpDelayHours;

  const summary =
    count === 0
      ? `Sem follow-up: se o lead não responder em ${formatDelay(hours)}, ele vai para "Sem resposta".`
      : `Se o lead não responder, o agente manda até ${count} follow-up${count > 1 ? "s" : ""}, um a cada ${formatDelay(hours)}. ` +
        `Sem resposta depois disso, ele vai para "Sem resposta".`;

  return (
    <form action={formAction} className="card" style={{ overflow: "hidden" }}>
      <div className="setting-row">
        <span className="setting-icon" style={{ background: "var(--brand-soft)", color: "var(--brand-ink)" }}>
          <IconRefresh size={19} />
        </span>
        <label htmlFor="followUpMaxCount" style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontWeight: 700 }}>Follow-ups</span>
          <span className="tiny faint">máximo por lead · 0 desliga</span>
        </label>
        <Stepper
          id="followUpMaxCount"
          name="followUpMaxCount"
          value={count}
          min={FOLLOW_UP_MAX_COUNT_RANGE[0]}
          max={FOLLOW_UP_MAX_COUNT_RANGE[1]}
          onChange={setCount}
        />
      </div>
      <div className="setting-row">
        <span className="setting-icon" style={{ background: "var(--info-soft)", color: "var(--info-ink)" }}>
          <IconClock size={19} />
        </span>
        <label htmlFor="followUpDelayHours" style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontWeight: 700 }}>Intervalo</span>
          <span className="tiny faint">horas sem resposta · {formatDelay(hours)}</span>
        </label>
        <Stepper
          id="followUpDelayHours"
          name="followUpDelayHours"
          value={hours}
          min={FOLLOW_UP_DELAY_HOURS_RANGE[0]}
          max={FOLLOW_UP_DELAY_HOURS_RANGE[1]}
          step={FOLLOW_UP_DELAY_STEP_HOURS}
          onChange={setHours}
        />
      </div>
      <div className="setting-row" style={{ alignItems: "flex-start", background: "var(--surface-2)" }}>
        <IconSparkles size={18} style={{ color: "var(--brand-ink)", flexShrink: 0, marginTop: 1 }} />
        <p className="tiny muted" style={{ lineHeight: 1.5 }}>
          {summary} Cada follow-up tem um texto diferente, escrito pelo agente com base na conversa, e conta no limite diário de
          mensagens.
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
              {pending ? "Salvando…" : "Salvar follow-up"}
            </button>
          )}
        </div>
      )}
    </form>
  );
}
