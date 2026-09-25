"use client";

import { useActionState, useState } from "react";
import { updateWorkHours } from "./actions";
import { IconCheck, IconClock } from "@/components/Icons";
import { Stepper } from "@/components/Stepper";

export function WorkHoursForm({ start, end, weekdaysOnly }: { start: number; end: number; weekdaysOnly: boolean }) {
  const [state, formAction, pending] = useActionState(updateWorkHours, undefined);
  const [from, setFrom] = useState(start);
  const [to, setTo] = useState(end);
  const [weekdays, setWeekdays] = useState(weekdaysOnly);
  const dirty = from !== start || to !== end || weekdays !== weekdaysOnly;

  return (
    <form action={formAction} className="card" style={{ overflow: "hidden" }}>
      <div className="setting-row">
        <span className="setting-icon" style={{ background: "var(--info-soft)", color: "var(--info-ink)" }}>
          <IconClock size={19} />
        </span>
        <label htmlFor="workStartHour" style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontWeight: 700 }}>Começa às</span>
          <span className="tiny faint">horário de Brasília</span>
        </label>
        <Stepper id="workStartHour" name="workStartHour" value={from} min={0} max={Math.min(23, to - 1)} onChange={setFrom} />
      </div>
      <div className="setting-row">
        <span className="setting-icon" style={{ background: "var(--info-soft)", color: "var(--info-ink)" }}>
          <IconClock size={19} />
        </span>
        <label htmlFor="workEndHour" style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontWeight: 700 }}>Termina às</span>
          <span className="tiny faint">nada sai depois disso</span>
        </label>
        <Stepper id="workEndHour" name="workEndHour" value={to} min={Math.max(1, from + 1)} max={24} onChange={setTo} />
      </div>
      <label className="setting-row" style={{ cursor: "pointer" }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontWeight: 700 }}>Só em dias úteis</span>
          <span className="tiny faint">sem mensagens sábado e domingo</span>
        </span>
        <input type="checkbox" name="workWeekdaysOnly" checked={weekdays} onChange={(e) => setWeekdays(e.target.checked)} className="sr-only" />
        <span className="switch switch-light" role="switch" aria-checked={weekdays} aria-hidden="true" />
      </label>
      <div className="setting-row" style={{ background: "var(--surface-2)" }}>
        <p className="tiny muted" style={{ lineHeight: 1.5 }}>
          A IA só manda mensagem {weekdays ? "de segunda a sexta" : "todos os dias"}, das {from}h às {to}h. Se um lead escrever fora
          disso, a resposta sai quando o horário abrir.
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
              {pending ? "Salvando…" : "Salvar horário"}
            </button>
          )}
        </div>
      )}
    </form>
  );
}
