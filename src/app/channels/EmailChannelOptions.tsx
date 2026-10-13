"use client";

import { useState, useTransition } from "react";
import { Help } from "@/components/Help";
import { Stepper } from "@/components/Stepper";
import { updateEmailChannel } from "./actions";

// O que o assistente pode fazer sozinha por e-mail. Salva a cada mudança.
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
    <div className="settings">
      <div className="setting">
        <span className="setting-text">
          <b>
            Usar o e-mail{" "}
            <Help>Desligado, o assistente só responde quem escrever por e-mail. Ele não começa nem retoma conversa por lá.</Help>
          </b>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={value.enabled}
          aria-label="Usar o e-mail"
          className="switch"
          onClick={() => save({ ...value, enabled: !value.enabled })}
        />
      </div>

      {value.enabled && (
        <>
          <div className="setting">
            <span className="setting-text">
              <b>
                Convite parado: apresentar-se por e-mail{" "}
                <Help>Se o convite do LinkedIn não for aceito e a pessoa tiver e-mail na ficha, o assistente se apresenta por e-mail.</Help>
              </b>
              {value.fallbackDays != null && <small>Depois de {value.fallbackDays} dias sem aceite</small>}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={value.fallbackDays != null}
              aria-label="Apresentar-se por e-mail quando o convite ficar parado"
              className="switch"
              onClick={() => save({ ...value, fallbackDays: value.fallbackDays == null ? 5 : null })}
            />
          </div>
          {value.fallbackDays != null && (
            <div className="setting" style={{ paddingTop: 0 }}>
              <label htmlFor="fallbackDays" className="setting-text">
                <small>Dias sem aceite</small>
              </label>
              <Stepper id="fallbackDays" name="fallbackDays" value={value.fallbackDays} min={1} max={30} onChange={(v) => save({ ...value, fallbackDays: v })} />
            </div>
          )}
          <div className="setting">
            <label htmlFor="dailyEmailLimit" className="setting-text">
              <b>
                E-mails por dia <Help>Apresentações e retomadas param no limite. Respostas a quem escreveu sempre saem.</Help>
              </b>
            </label>
            <Stepper id="dailyEmailLimit" name="dailyEmailLimit" value={value.dailyLimit} min={1} max={100} onChange={(v) => save({ ...value, dailyLimit: v })} />
          </div>
        </>
      )}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
