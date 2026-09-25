"use client";

import { useOptimistic, useState, useTransition } from "react";
import { setEngagementFlag, setWithdrawAfterDays, type EngagementFlag } from "./actions";
import { Stepper } from "@/components/Stepper";

const OPTIONS: { flag: EngagementFlag; title: string; text: string }[] = [
  {
    flag: "acceptInvitesEnabled",
    title: "Aceitar convites recebidos",
    text: "Quem te convidar vira lead e a IA abre a conversa. Checado 1x por hora.",
  },
  {
    flag: "warmupEnabled",
    title: "Aquecer antes de convidar",
    text: "Visita e segue o perfil antes do convite — a pessoa vê seu nome primeiro.",
  },
  {
    flag: "withdrawInvitesEnabled",
    title: "Retirar convites parados",
    text: "Convite sem resposta há muito tempo pesa contra a conta. Retira e marca como sem resposta.",
  },
  {
    flag: "archiveLostEnabled",
    title: "Arquivar conversas perdidas",
    text: "Leads sem resposta saem da sua caixa de entrada do LinkedIn.",
  },
];

export function EngagementForm({ values, withdrawAfterDays }: { values: Record<EngagementFlag, boolean>; withdrawAfterDays: number }) {
  const [optimistic, setOptimistic] = useOptimistic(values, (state, [flag, on]: [EngagementFlag, boolean]) => ({ ...state, [flag]: on }));
  const [days, setDays] = useState(withdrawAfterDays);
  const [, startTransition] = useTransition();

  function toggle(flag: EngagementFlag) {
    const next = !optimistic[flag];
    startTransition(async () => {
      setOptimistic([flag, next]);
      await setEngagementFlag(flag, next);
    });
  }

  function changeDays(v: number) {
    setDays(v);
    startTransition(async () => {
      await setWithdrawAfterDays(v);
    });
  }

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      {OPTIONS.map((o, i) => (
        <div key={o.flag} style={i > 0 ? { borderTop: "1px solid var(--border)" } : undefined}>
          <div className="setting-row">
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontWeight: 700 }}>{o.title}</span>
              <span className="tiny faint">{o.text}</span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={optimistic[o.flag]}
              aria-label={o.title}
              className="switch switch-light"
              onClick={() => toggle(o.flag)}
            />
          </div>
          {o.flag === "withdrawInvitesEnabled" && optimistic.withdrawInvitesEnabled && (
            <div className="setting-row" style={{ paddingTop: 0, borderTop: "none" }}>
              <label htmlFor="withdrawAfterDays" className="small muted" style={{ flex: 1 }}>
                Retirar depois de {days} dias sem aceite
              </label>
              <Stepper id="withdrawAfterDays" name="withdrawAfterDays" value={days} min={7} max={90} onChange={changeDays} />
            </div>
          )}
        </div>
      ))}
      <div className="setting-row" style={{ background: "var(--surface-2)" }}>
        <p className="tiny muted" style={{ lineHeight: 1.5 }}>
          Ações Engagement da edges.run, sem crédito extra. Só rodam com a automação ligada e dentro do horário de trabalho.
        </p>
      </div>
    </div>
  );
}
