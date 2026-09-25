import type { LeadStatus, MessageSender } from "@prisma/client";

// Números de uma campanha em linguagem simples: quantos foram convidados,
// aceitaram, responderam e viraram oportunidade (qualificados).
export interface CampaignNumbers {
  invited: number;
  connected: number;
  replied: number;
  qualified: number;
}

export function campaignNumbers(leads: { status: LeadStatus; messages: { sender: MessageSender }[] }[]): CampaignNumbers {
  return {
    invited: leads.length,
    connected: leads.filter((l) => l.status !== "INVITE_SENT").length,
    replied: leads.filter((l) => l.messages.some((m) => m.sender === "LEAD")).length,
    qualified: leads.filter((l) => l.status === "QUALIFIED").length,
  };
}
