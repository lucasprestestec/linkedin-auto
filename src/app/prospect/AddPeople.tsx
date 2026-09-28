"use client";

import { ProspectTabs } from "../campaigns/ProspectTabs";
import { ProspectSearch } from "../campaigns/ProspectSearch";
import { WarmSuggestions } from "../campaigns/WarmSuggestions";
import { ProspectProvider, type CampaignOption } from "../campaigns/InviteSheet";

// Prospectar: primeiro encontra e marca as pessoas; a campanha (opcional) só é
// escolhida no fim, na hora de confirmar os convites. Vindo de uma campanha
// (?campaign=), ela já aparece marcada e o público dela entra como palavra-chave.
export function AddPeople({
  campaigns,
  initialCampaignId,
  initialKeywords,
  invitesLeft,
  searchEnabled,
  searchesLeft,
}: {
  campaigns: CampaignOption[];
  initialCampaignId: string;
  initialKeywords: string[];
  invitesLeft: number;
  searchEnabled: boolean;
  searchesLeft: number;
}) {
  return (
    <ProspectProvider value={{ campaigns, defaultCampaignId: initialCampaignId, invitesLeft }}>
      <ProspectTabs
        warm={<WarmSuggestions />}
        search={<ProspectSearch initialKeywords={initialKeywords} searchEnabled={searchEnabled} searchesLeft={searchesLeft} />}
      />
    </ProspectProvider>
  );
}
