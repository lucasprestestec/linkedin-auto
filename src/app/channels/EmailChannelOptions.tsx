"use client";

import { useState, useTransition } from "react";
import { Stepper } from "@/components/Stepper";
import { IconAlert } from "@/components/Icons";
import { updateEmailChannel } from "./actions";

// O que a secretária pode fazer sozinha por e-mail. Salva a cada mudança.
export function EmailChannelOptions({ enabled, dailyLimit, fallbackDays }: { enabled: boolean; dailyLimit: number; fallbackDays: number | null }) {
  const [value, setValue] = useState({ enabled, dailyLimit, fallbackDays });
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  function save(next: typeof value) {
    const prev = value;
    setValue(next);
    setError(null);
    start(async () => {
      const r = await updateEmailChannel(next);
      if (r.error) {
        setError(r.error);
        setValue(prev);
      }
    });
  }

  return (
    <div className="channel-options">
      <div className="setting-row">
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontWeight: 700 }}>A secretária pode usar o e-mail</span>
          <span className="tiny faint">Desligado, ela só responde quem escrever por e-mail; não inicia nem retoma por lá.</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={value.enabled}
          aria-label="A secretária pode usar o e-mail"
          className="switch switch-light"
          onClick={() => save({ ...value, enabled: !value.enabled })}
        />
      </div>

      {value.enabled && (
        <>
          <div className="setting-row">
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontWeight: 700 }}>Convite parado? Apresentar-se por e-mail</span>
              <span className="tiny faint">
                {value.fallbackDays == null
                  ? "Desligado: ela espera o convite ser aceito."
                  : `Se o convite do LinkedIn não for aceito em ${value.fallbackDays} dias e a pessoa tiver e-mail na ficha.`}
              </span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={value.fallbackDays != null}
              aria-label="Apresentar-se por e-mail quando o convite ficar parado"
              className="switch switch-light"
              onClick={() => save({ ...value, fallbackDays: value.fallbackDays == null ? 5 : null })}
            />
          </div>
          {value.fallbackDays != null && (
            <div className="setting-row" style={{ paddingTop: 0 }}>
              <label htmlFor="fallbackDays" className="small muted" style={{ flex: 1 }}>
                Depois de quantos dias sem aceite
              </label>
              <Stepper id="fallbackDays" name="fallbackDays" value={value.fallbackDays} min={1} max={30} onChange={(v) => save({ ...value, fallbackDays: v })} />
            </div>
          )}
          <div className="setting-row">
            <label htmlFor="dailyEmailLimit" style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontWeight: 700 }}>E-mails por dia</span>
              <span className="tiny faint">Apresentações e retomadas param no limite; respostas a quem escreveu sempre saem.</span>
            </label>
            <Stepper id="dailyEmailLimit" name="dailyEmailLimit" value={value.dailyLimit} min={1} max={100} onChange={(v) => save({ ...value, dailyLimit: v })} />
          </div>
        </>
      )}
      {error && (
        <p className="error-text" style={{ padding: "0 16px 12px" }}>
          <IconAlert size={15} /> {error}
        </p>
      )}
    </div>
  );
}
