import type { LeadStatus, MessageSender } from "@prisma/client";

// Números de uma campanha em linguagem simples.
export interface CampaignNumbers {
  leads: number;
  connected: number;
  contacted: number;
  replied: number;
  qualified: number;
  // Responderam ÷ receberam mensagem nossa (null se ninguém foi contatado).
  rate: number | null;
}

export function campaignNumbers(leads: { status: LeadStatus; messages: { sender: MessageSender }[] }[]): CampaignNumbers {
  const contacted = leads.filter((l) => l.messages.some((m) => m.sender !== "LEAD"));
  const repliedAfter = contacted.filter((l) => l.messages.some((m) => m.sender === "LEAD")).length;
  return {
    leads: leads.length,
    connected: leads.filter((l) => l.status !== "INVITE_SENT").length,
    contacted: contacted.length,
    replied: leads.filter((l) => l.messages.some((m) => m.sender === "LEAD")).length,
    qualified: leads.filter((l) => l.status === "QUALIFIED").length,
    rate: contacted.length ? Math.round((repliedAfter / contacted.length) * 100) : null,
  };
}

export const CAMPAIGN_STATUS_LABEL = { ACTIVE: "Ativa", PAUSED: "Pausada", FINISHED: "Finalizada" } as const;
export const CAMPAIGN_STATUS_CLASS = { ACTIVE: "s-active", PAUSED: "s-paused", FINISHED: "s-finished" } as const;
