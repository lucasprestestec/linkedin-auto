"use client";

import { useOptimistic, useTransition } from "react";
import { Help } from "@/components/Help";
import { updateDailySummary } from "./actions";

// Liga/desliga o resumo do fim do expediente.
export function DailySummaryToggle({ enabled, endHour, hasEmail, hasPush }: { enabled: boolean; endHour: number; hasEmail: boolean; hasPush: boolean }) {
  const [value, setValue] = useOptimistic(enabled);
  const [, start] = useTransition();
  const where = [hasPush && "notificação no celular", hasEmail && "e-mail na sua caixa"].filter(Boolean).join(" e ") || "o painel (ative os avisos no celular ou conecte o e-mail para receber)";

  return (
    <div className="setting" style={{ padding: 0 }}>
      <p className="grow">
        Às {endHour}h, quando o expediente acaba, a secretária manda um resumo do dia.{" "}
        <Help>Convites, mensagens, quem respondeu, quem abriu seus e-mails e quem precisa de você. Chega por {where}. Dia sem novidade não gera aviso.</Help>
      </p>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label="Resumo do dia"
        className="switch"
        onClick={() =>
          start(async () => {
            setValue(!value);
            await updateDailySummary(!value);
          })
        }
      />
    </div>
  );
}
