"use client";

import { Stepper } from "./Stepper";
import { IconClock, IconRefresh } from "./Icons";
import { FOLLOW_UP_DELAY_DAYS_RANGE, FOLLOW_UP_MAX_COUNT_RANGE } from "@/lib/settings-ranges";

export interface FollowUpValue {
  count: number;
  days: number;
}

export function followUpSummary({ count, days }: FollowUpValue): string {
  if (count === 0) return `Sem follow-up: se não responder em ${days} dia${days > 1 ? "s" : ""}, a conversa vai para "Sem resposta".`;
  return `Se a pessoa não responder, a IA manda até ${count} follow-up${count > 1 ? "s" : ""}, um a cada ${days} dia${
    days > 1 ? "s" : ""
  }. Depois disso, a conversa vai para "Sem resposta".`;
}

// Os dois números do follow-up: quantos e de quanto em quanto tempo.
export function FollowUpFields({ value, onChange, idPrefix }: { value: FollowUpValue; onChange: (v: FollowUpValue) => void; idPrefix: string }) {
  return (
    <div className="fu-fields">
      <div className="fu-row">
        <span className="fu-icon">
          <IconRefresh size={17} />
        </span>
        <label htmlFor={`${idPrefix}-count`} className="fu-label">
          <b>Quantos follow-ups</b>
          <span>0 desliga · máximo {FOLLOW_UP_MAX_COUNT_RANGE[1]}</span>
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
      <div className="fu-row">
        <span className="fu-icon">
          <IconClock size={17} />
        </span>
        <label htmlFor={`${idPrefix}-days`} className="fu-label">
          <b>Intervalo</b>
          <span>
            dias sem resposta · de {FOLLOW_UP_DELAY_DAYS_RANGE[0]} a {FOLLOW_UP_DELAY_DAYS_RANGE[1]}
          </span>
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
      <p className="fu-summary">{followUpSummary(value)}</p>
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
    <div className="fu-override">
      <div className="seg-choice" role="radiogroup" aria-label="Regra de follow-up">
        <button type="button" role="radio" aria-checked={custom === null} onClick={() => onChange(null)}>
          <b>Usar o padrão</b>
          <span>{inheritedLabel}</span>
        </button>
        <button type="button" role="radio" aria-checked={custom !== null} onClick={() => onChange(custom ?? { count: 2, days: 2 })}>
          <b>Personalizar</b>
          <span>Escolher número e intervalo</span>
        </button>
      </div>
      {custom && <FollowUpFields value={custom} onChange={onChange} idPrefix={idPrefix} />}
    </div>
  );
}
