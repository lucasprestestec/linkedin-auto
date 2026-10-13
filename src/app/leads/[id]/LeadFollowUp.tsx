"use client";

import { useState, useTransition } from "react";
import { Help } from "@/components/Help";
import { FollowUpOverride, type FollowUpValue } from "@/components/FollowUpFields";
import { updateLeadFollowUp } from "./actions";

// Acompanhamento só desta conversa. "Usar o padrão" = regra da campanha ou da conta.
export function LeadFollowUp({
  leadId,
  custom,
  inheritedLabel,
  sent,
}: {
  leadId: string;
  custom: FollowUpValue | null;
  inheritedLabel: string;
  sent: number;
}) {
  const [value, setValue] = useState<FollowUpValue | null>(custom);
  const [saved, setSaved] = useState<FollowUpValue | null>(custom);
  const [pending, startTransition] = useTransition();
  const dirty = JSON.stringify(value) !== JSON.stringify(saved);

  return (
    <section className="sec">
      <h2 className="t-label">
        Acompanhamento
        <Help>Se a pessoa não responder, o assistente manda novas mensagens depois de alguns dias. Aqui você muda isso só para esta conversa.</Help>
        {sent > 0 && <span className="faint" style={{ marginLeft: "auto" }}>{sent} enviada{sent > 1 ? "s" : ""}</span>}
      </h2>
      <FollowUpOverride custom={value} onChange={setValue} inheritedLabel={inheritedLabel} idPrefix={`fu-${leadId}`} />
      {(dirty || pending) && (
        <div>
          <button
            type="button"
            className="btn-solid btn-sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await updateLeadFollowUp(leadId, value);
                if (!r.error) setSaved(value);
              })
            }
          >
            {pending ? "Salvando…" : "Salvar"}
          </button>
        </div>
      )}
    </section>
  );
}
