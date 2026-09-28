"use client";

import { useState } from "react";
import { ProspectTabs } from "../campaigns/ProspectTabs";
import { ProspectSearch } from "../campaigns/ProspectSearch";
import { WarmSuggestions } from "../campaigns/WarmSuggestions";

// Adicionar pessoas: campanha é opcional. O público da campanha escolhida ao
// abrir a tela já entra como palavra-chave; trocar depois não apaga a busca —
// a campanha vale pra quem for convidado dali em diante.
export function AddPeople({
  campaigns,
  initialCampaignId,
  searchEnabled,
  searchesLeft,
}: {
  campaigns: { id: string; name: string; audience: string[] }[];
  initialCampaignId: string;
  searchEnabled: boolean;
  searchesLeft: number;
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
        warm={<WarmSuggestions campaignId={campaignId || undefined} />}
        search={
          <ProspectSearch
            campaignId={campaignId || undefined}
            initialKeywords={campaign?.audience ?? []}
            searchEnabled={searchEnabled}
            searchesLeft={searchesLeft}
          />
        }
      />
    </div>
  );
}
