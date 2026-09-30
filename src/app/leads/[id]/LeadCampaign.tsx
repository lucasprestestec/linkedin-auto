"use client";

import { useState, useTransition } from "react";
import { Help } from "@/components/Help";
import { updateLeadCampaign } from "./actions";

// Campanha da pessoa: o assistente usa a oferta dela nesta conversa.
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

  if (campaigns.length === 0) return null;

  return (
    <section className="sec">
      <h2 className="t-label">
        Campanha
        <Help>O assistente usa a oferta da campanha escolhida ao conversar com esta pessoa.</Help>
      </h2>
      <select
        className="field"
        value={value}
        aria-label="Campanha"
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
    </section>
  );
}
