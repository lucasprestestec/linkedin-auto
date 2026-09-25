"use client";

import { useState, useTransition } from "react";
import { IconMegaphone, IconRocket } from "@/components/Icons";
import { updateLeadCampaign } from "./actions";

// Campanha do lead: a IA usa as instruções dela nesta conversa.
export function LeadCampaign({
  leadId,
  campaignId,
  campaigns,
}: {
  leadId: string;
  campaignId: string | null;
  campaigns: { id: string; name: string; since: string }[];
}) {
  const [value, setValue] = useState(campaignId ?? "");
  const [, startTransition] = useTransition();
  const current = campaigns.find((c) => c.id === value);

  return (
    <section className="side-card">
      <div className="side-card-head">
        <h3>
          <IconMegaphone size={19} /> Campanha
        </h3>
      </div>
      <label className="campaign-box">
        <span className="campaign-icon">
          <IconRocket size={20} />
        </span>
        <span className="stack" style={{ flex: 1, minWidth: 0 }}>
          <b className="truncate">{current?.name ?? "Sem campanha"}</b>
          <span className="tiny faint">{current ? `Criada em ${current.since}` : "Opcional — agrupa por oferta"}</span>
        </span>
        {campaigns.length > 0 && (
          <select
            className="campaign-select"
            value={value}
            aria-label="Trocar campanha"
            onChange={(e) => {
              setValue(e.target.value);
              startTransition(async () => {
                await updateLeadCampaign(leadId, e.target.value || null);
              });
            }}
          >
            <option value="">Sem campanha</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        <span className="campaign-dots" aria-hidden="true">
          •••
        </span>
      </label>
    </section>
  );
}
