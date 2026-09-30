"use client";

import { useActionState, useState } from "react";
import { updateWorkHours } from "./actions";
import { Stepper } from "@/components/Stepper";

export function WorkHoursForm({ start, end, weekdaysOnly }: { start: number; end: number; weekdaysOnly: boolean }) {
  const [state, formAction, pending] = useActionState(updateWorkHours, undefined);
  const [from, setFrom] = useState(start);
  const [to, setTo] = useState(end);
  const [weekdays, setWeekdays] = useState(weekdaysOnly);
  const dirty = from !== start || to !== end || weekdays !== weekdaysOnly;

  return (
    <form action={formAction} className="stack" style={{ gap: 4 }}>
      <div className="setting" style={{ padding: "8px 0" }}>
        <label htmlFor="workStartHour" className="setting-text">
          <b>Começa às</b>
          <small>horário de Brasília</small>
        </label>
        <Stepper id="workStartHour" name="workStartHour" value={from} min={0} max={Math.min(23, to - 1)} onChange={setFrom} />
      </div>
      <div className="setting" style={{ padding: "8px 0" }}>
        <label htmlFor="workEndHour" className="setting-text">
          <b>Termina às</b>
          <small>nada sai depois disso</small>
        </label>
        <Stepper id="workEndHour" name="workEndHour" value={to} min={Math.max(1, from + 1)} max={24} onChange={setTo} />
      </div>
      <div className="setting" style={{ padding: "8px 0" }}>
        <span className="setting-text">
          <b>Só em dias úteis</b>
          <small>sem mensagens sábado e domingo</small>
        </span>
        <input type="hidden" name="workWeekdaysOnly" value={weekdays ? "on" : ""} />
        <button type="button" role="switch" aria-checked={weekdays} aria-label="Só em dias úteis" className="switch" onClick={() => setWeekdays((w) => !w)} />
      </div>
      <p className="hint">
        O assistente só manda mensagem {weekdays ? "de segunda a sexta" : "todos os dias"}, das {from}h às {to}h. Se uma pessoa escrever fora disso, a resposta sai
        quando o horário abrir.
      </p>
      {(dirty || state?.saved || state?.error) && (
        <div className="form-actions">
          {dirty && (
            <button type="submit" className="btn-solid btn-sm" disabled={pending}>
              {pending ? "Salvando…" : "Salvar horário"}
            </button>
          )}
          {!dirty && state?.saved && <span className="ok-text">Salvo</span>}
          {state?.error && <span className="field-error">{state.error}</span>}
        </div>
      )}
    </form>
  );
}
