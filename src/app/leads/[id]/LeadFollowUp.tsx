"use client";

import { useState, useTransition } from "react";
import { FollowUpOverride, type FollowUpValue } from "@/components/FollowUpFields";
import { IconCheck, IconRefresh } from "@/components/Icons";
import { updateLeadFollowUp } from "./actions";

// Follow-up só desta conversa. "Usar o padrão" = regra da campanha ou da conta.
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
    <section className="side-card">
      <div className="side-card-head">
        <h3>
          <IconRefresh size={18} /> Follow-up
        </h3>
        {sent > 0 && <span className="tiny faint">{sent} já enviado{sent > 1 ? "s" : ""}</span>}
      </div>
      <FollowUpOverride custom={value} onChange={setValue} inheritedLabel={inheritedLabel} idPrefix={`fu-${leadId}`} />
      {(dirty || pending) && (
        <button
          type="button"
          className="btn btn-primary btn-sm"
          style={{ alignSelf: "flex-end" }}
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
      )}
      {!dirty && !pending && JSON.stringify(saved) !== JSON.stringify(custom) && (
        <span className="success-text" style={{ alignSelf: "flex-end" }}>
          <IconCheck size={15} strokeWidth={3} /> Salvo
        </span>
      )}
    </section>
  );
}
