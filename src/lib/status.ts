import type { LeadStatus } from "@prisma/client";

export const STATUS_LABEL: Record<LeadStatus, string> = {
  NEEDS_HUMAN: "Precisa de você",
  CONVERSATION_OPEN: "Conversando",
  WAITING_REPLY: "Aguardando resposta",
  INVITE_SENT: "Convite enviado",
  QUALIFIED: "Qualificado",
  LOST: "Sem resposta",
};

// Sufixo das classes .badge-* / .status-* do globals.css.
export type StatusTone = "urgent" | "open" | "waiting" | "qualified" | "invite" | "lost";

export const STATUS_TONE: Record<LeadStatus, StatusTone> = {
  NEEDS_HUMAN: "urgent",
  CONVERSATION_OPEN: "open",
  WAITING_REPLY: "waiting",
  QUALIFIED: "qualified",
  INVITE_SENT: "invite",
  LOST: "lost",
};

export interface LeadSection {
  key: string;
  label: string;
  statuses: LeadStatus[];
}

export const LEAD_SECTIONS: LeadSection[] = [
  { key: "urgent", label: "Precisa de você", statuses: ["NEEDS_HUMAN"] },
  { key: "open", label: "Conversando", statuses: ["CONVERSATION_OPEN", "QUALIFIED"] },
  { key: "waiting", label: "Aguardando resposta", statuses: ["WAITING_REPLY"] },
  { key: "invited", label: "Convites", statuses: ["INVITE_SENT"] },
  { key: "lost", label: "Sem resposta", statuses: ["LOST"] },
];

// Leads em que o sistema ainda age sozinho (abertura / follow-up). NEEDS_HUMAN e
// QUALIFIED ficam de fora: ali quem conduz é o corretor — um follow-up
// automático por cima de uma reunião marcada seria constrangedor.
export const PROACTIVE_STATUSES: LeadStatus[] = ["WAITING_REPLY", "CONVERSATION_OPEN"];
