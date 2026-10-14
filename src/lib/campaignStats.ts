import type { LeadStatus, MessageChannel, MessageSender } from "@prisma/client";

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

// Números por canal, em pessoas (cada pessoa conta uma vez por linha), para o painel da campanha.
export interface ChannelNumbers {
  email: { sent: number; opened: number; replied: number; optedOut: number };
  linkedin: { added: number; accepted: number; replied: number };
  whatsapp: { have: number; replied: number };
}

interface ChannelLead {
  linkedinConnected: boolean;
  invitedAt: Date | null;
  phone: string | null;
  doNotContact: boolean;
  messages: { sender: MessageSender; channel: MessageChannel; openCount: number }[];
}

export function channelNumbers(leads: ChannelLead[]): ChannelNumbers {
  const out = (l: ChannelLead, ch: MessageChannel) => l.messages.filter((m) => m.channel === ch && m.sender !== "LEAD");
  const replied = (l: ChannelLead, ch: MessageChannel) => l.messages.some((m) => m.channel === ch && m.sender === "LEAD");
  const sentMail = leads.filter((l) => out(l, "EMAIL").length > 0);
  return {
    email: {
      sent: sentMail.length,
      opened: sentMail.filter((l) => out(l, "EMAIL").some((m) => m.openCount > 0)).length,
      replied: leads.filter((l) => replied(l, "EMAIL")).length,
      // ponytail: "pediu para sair" é da pessoa, não do canal; conta quem recebeu e-mail e foi marcado.
      optedOut: sentMail.filter((l) => l.doNotContact).length,
    },
    linkedin: {
      added: leads.filter((l) => l.invitedAt || l.linkedinConnected).length,
      accepted: leads.filter((l) => l.linkedinConnected).length,
      replied: leads.filter((l) => replied(l, "LINKEDIN")).length,
    },
    whatsapp: {
      have: leads.filter((l) => l.phone?.trim()).length,
      replied: leads.filter((l) => replied(l, "WHATSAPP")).length,
    },
  };
}
