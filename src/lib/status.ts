import type { LeadStatus } from "@prisma/client";

export const STATUS_LABEL: Record<LeadStatus, string> = {
  NEEDS_HUMAN: "Precisa de você",
  CONVERSATION_OPEN: "Conversando",
  INVITE_SENT: "Convite enviado",
  QUALIFIED: "Qualificado",
  LOST: "Sem resposta",
};

export const STATUS_ORDER: LeadStatus[] = [
  "NEEDS_HUMAN",
  "CONVERSATION_OPEN",
  "QUALIFIED",
  "INVITE_SENT",
  "LOST",
];

export function statusColors(status: LeadStatus) {
  switch (status) {
    case "NEEDS_HUMAN":
      return { fg: "var(--accent-urgent)", bg: "var(--accent-urgent-bg)" };
    case "CONVERSATION_OPEN":
    case "QUALIFIED":
      return { fg: "var(--accent-open)", bg: "var(--accent-open-bg)" };
    default:
      return { fg: "var(--accent-idle)", bg: "var(--accent-idle-bg)" };
  }
}
