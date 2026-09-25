"use client";

import { useState } from "react";
import { ProspectTabs } from "../campaigns/ProspectTabs";
import { ProspectSearch } from "../campaigns/ProspectSearch";
import { WarmSuggestions } from "../campaigns/WarmSuggestions";

// Adicionar pessoas: campanha é opcional. Trocar a campanha recria a busca
// (o público dela entra como palavra-chave).
export function AddPeople({
  campaigns,
  initialCampaignId,
}: {
  campaigns: { id: string; name: string; audience: string[] }[];
  initialCampaignId: string;
}) {
  const [campaignId, setCampaignId] = useState(initialCampaignId);
  const campaign = campaigns.find((c) => c.id === campaignId);

  return (
    <div className="stack" style={{ gap: 18 }}>
      {campaigns.length > 0 && (
        <label className="campaign-pick">
          <span className="stack" style={{ gap: 2, flex: 1, minWidth: 0 }}>
            <b>Campanha</b>
            <span className="tiny faint">Opcional. Com campanha, a IA usa a oferta dela na conversa.</span>
          </span>
          <select className="input" value={campaignId} onChange={(e) => setCampaignId(e.target.value)} aria-label="Campanha">
            <option value="">Sem campanha</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <ProspectTabs
        key={campaignId}
        warm={<WarmSuggestions campaignId={campaignId || undefined} />}
        search={<ProspectSearch campaignId={campaignId || undefined} initialKeywords={campaign?.audience ?? []} />}
      />
    </div>
  );
}
