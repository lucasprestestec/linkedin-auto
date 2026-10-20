import type { LeadStatus, MessageChannel, MessageSender, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { readableReason, relativeTime, splitHeadline } from "@/lib/format";

// Uma linha da lista de conversas (Início, Conversas e ao lado do chat).
export interface ConvItem {
  id: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  role: string | null;
  company: string | null;
  status: LeadStatus;
  needsHumanReason: string | null;
  lastMessage: { content: string; sender: MessageSender } | null;
  // Canal da última mensagem (para o ícone na lista); vazio quando ainda não houve mensagem.
  channel: MessageChannel | null;
  // A última mensagem é do lead: ninguém respondeu ainda.
  unanswered: boolean;
  replied: boolean;
  // Há uma mensagem do assistente esperando a sua aprovação.
  hasDraft: boolean;
  tags: string[];
  campaignId: string | null;
  campaignName: string | null;
  assigneeName: string | null;
  nextStep: string | null;
  // Pré-formatado no servidor: evita divergência de hidratação por relógio.
  when: string;
  whenTs: number;
}

// O que buscar de cada contato para montar a linha (compartilhado com a lista de Contatos).
export const convInclude = {
  messages: { orderBy: { deliveredAt: "desc" as const }, take: 1 },
  campaign: { select: { name: true } },
  assignee: { select: { name: true } },
  _count: { select: { messages: { where: { sender: "LEAD" as const } }, drafts: { where: { status: "PENDING" as const } } } },
} satisfies Prisma.LeadInclude;

export function toConvItem(l: Prisma.LeadGetPayload<{ include: typeof convInclude }>): ConvItem {
  const last = l.messages[0];
  const when = last?.deliveredAt ?? l.updatedAt;
  const { role, company } = splitHeadline(l.jobTitle);
  return {
    id: l.id,
    firstName: l.firstName,
    lastName: l.lastName,
    avatarUrl: l.avatarUrl,
    role,
    company,
    status: l.status,
    needsHumanReason: l.needsHumanReason && readableReason(l.needsHumanReason),
    lastMessage: last ? { content: last.content, sender: last.sender } : null,
    channel: last?.channel ?? null,
    unanswered: last?.sender === "LEAD",
    replied: l._count.messages > 0,
    hasDraft: l._count.drafts > 0,
    tags: l.tags,
    campaignId: l.campaignId,
    campaignName: l.campaign?.name ?? null,
    assigneeName: l.assignee?.name ?? null,
    nextStep: l.nextStep,
    when: relativeTime(when),
    whenTs: when.getTime(),
  };
}

export async function getConversationItems(): Promise<ConvItem[]> {
  const leads = await prisma.lead.findMany({ include: convInclude });
  return leads.map(toConvItem).sort((a, b) => b.whenTs - a.whenTs);
}
