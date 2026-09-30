"use client";

import { Stepper } from "./Stepper";
import { FOLLOW_UP_DELAY_DAYS_RANGE, FOLLOW_UP_MAX_COUNT_RANGE } from "@/lib/settings-ranges";

export interface FollowUpValue {
  count: number;
  days: number;
}

export function followUpSummary({ count, days }: FollowUpValue): string {
  if (count === 0) return `Sem acompanhamento: se não responder em ${days} dia${days > 1 ? "s" : ""}, a conversa vai para "Sem resposta".`;
  return `Se a pessoa não responder, o assistente manda até ${count} mensage${count > 1 ? "ns" : "m"}, uma a cada ${days} dia${
    days > 1 ? "s" : ""
  }. Depois disso, a conversa vai para "Sem resposta".`;
}

// Os dois números do acompanhamento: quantas mensagens e de quanto em quanto tempo.
export function FollowUpFields({ value, onChange, idPrefix }: { value: FollowUpValue; onChange: (v: FollowUpValue) => void; idPrefix: string }) {
  return (
    <div className="stack" style={{ gap: 4 }}>
      <div className="setting" style={{ padding: "8px 0" }}>
        <label htmlFor={`${idPrefix}-count`} className="setting-text">
          <b>Quantas mensagens</b>
          <small>0 desliga · máximo {FOLLOW_UP_MAX_COUNT_RANGE[1]}</small>
        </label>
        <Stepper
          id={`${idPrefix}-count`}
          name={`${idPrefix}-count`}
          value={value.count}
          min={FOLLOW_UP_MAX_COUNT_RANGE[0]}
          max={FOLLOW_UP_MAX_COUNT_RANGE[1]}
          onChange={(count) => onChange({ ...value, count })}
        />
      </div>
      <div className="setting" style={{ padding: "8px 0" }}>
        <label htmlFor={`${idPrefix}-days`} className="setting-text">
          <b>Intervalo</b>
          <small>
            dias sem resposta · de {FOLLOW_UP_DELAY_DAYS_RANGE[0]} a {FOLLOW_UP_DELAY_DAYS_RANGE[1]}
          </small>
        </label>
        <Stepper
          id={`${idPrefix}-days`}
          name={`${idPrefix}-days`}
          value={value.days}
          min={FOLLOW_UP_DELAY_DAYS_RANGE[0]}
          max={FOLLOW_UP_DELAY_DAYS_RANGE[1]}
          onChange={(days) => onChange({ ...value, days })}
        />
      </div>
      <p className="hint">{followUpSummary(value)}</p>
    </div>
  );
}

// Campanha / conversa: usar o padrão de cima ou personalizar.
export function FollowUpOverride({
  custom,
  onChange,
  inheritedLabel,
  idPrefix,
}: {
  custom: FollowUpValue | null;
  onChange: (v: FollowUpValue | null) => void;
  inheritedLabel: string;
  inheritedValue?: FollowUpValue;
  idPrefix: string;
}) {
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="choice" role="radiogroup" aria-label="Regra de acompanhamento">
        <button type="button" role="radio" aria-checked={custom === null} onClick={() => onChange(null)}>
          Usar o padrão
          <small>{inheritedLabel}</small>
        </button>
        <button type="button" role="radio" aria-checked={custom !== null} onClick={() => onChange(custom ?? { count: 2, days: 2 })}>
          Personalizar
        </button>
      </div>
      {custom && <FollowUpFields value={custom} onChange={onChange} idPrefix={idPrefix} />}
    </div>
  );
}
