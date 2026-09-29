"use client";

import { useOptimistic, useTransition } from "react";
import { updateDailySummary } from "./actions";

// Liga/desliga o resumo do fim do expediente.
export function DailySummaryToggle({ enabled, endHour, hasEmail, hasPush }: { enabled: boolean; endHour: number; hasEmail: boolean; hasPush: boolean }) {
  const [value, setValue] = useOptimistic(enabled);
  const [, start] = useTransition();
  const where = [hasPush && "notificação no celular", hasEmail && "e-mail na sua caixa"].filter(Boolean).join(" e ") || "painel (ative os avisos no celular ou conecte o e-mail pra receber)";

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
        <p className="small muted" style={{ flex: 1 }}>
          Às {endHour}h, quando o expediente acaba, a secretária manda um resumo: convites, mensagens, quem respondeu, quem abriu seus e-mails e
          quem precisa de você. Chega por {where}. Dia sem novidade não gera aviso.
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={value}
          aria-label="Resumo do dia"
          className="switch switch-light"
          onClick={() =>
            start(async () => {
              setValue(!value);
              await updateDailySummary(!value);
            })
          }
        />
      </div>
    </div>
  );
}
