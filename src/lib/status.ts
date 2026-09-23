import type { LeadStatus } from "@prisma/client";

export const STATUS_LABEL: Record<LeadStatus, string> = {
  NEEDS_HUMAN: "Precisa de você",
  CONVERSATION_OPEN: "Conversando",
  INVITE_SENT: "Convite enviado",
  QUALIFIED: "Qualificado",
  LOST: "Sem resposta",
};

export function statusColor(status: LeadStatus): string {
  switch (status) {
    case "NEEDS_HUMAN":
      return "var(--accent-urgent)";
    case "CONVERSATION_OPEN":
    case "QUALIFIED":
      return "var(--accent-open)";
    default:
      return "var(--accent-idle)";
  }
}

export interface LeadSection {
  key: string;
  label: string;
  statuses: LeadStatus[];
}

export const LEAD_SECTIONS: LeadSection[] = [
  { key: "urgent", label: "Precisa de você", statuses: ["NEEDS_HUMAN"] },
  { key: "open", label: "Conversando", statuses: ["CONVERSATION_OPEN", "QUALIFIED"] },
  { key: "invited", label: "Convite enviado", statuses: ["INVITE_SENT"] },
  { key: "lost", label: "Sem resposta", statuses: ["LOST"] },
];
