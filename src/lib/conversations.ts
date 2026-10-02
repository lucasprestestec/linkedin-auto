import type { LeadStatus, MessageChannel, MessageSender } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { readableReason, relativeTime, splitHeadline } from "@/lib/format";

// Uma linha da lista de conversas (Início, Conversas e ao lado do chat).
export interface ConvItem {
  id: string;
  firstName: string | null;
  lastName: string | null;
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
  // Pré-formatado no servidor: evita divergência de hidratação por relógio.
  when: string;
  whenTs: number;
}

export async function getConversationItems(): Promise<ConvItem[]> {
  const leads = await prisma.lead.findMany({
    include: {
      messages: { orderBy: { deliveredAt: "desc" }, take: 1 },
      campaign: { select: { name: true } },
      _count: { select: { messages: { where: { sender: "LEAD" } }, drafts: { where: { status: "PENDING" } } } },
    },
  });
  return leads
    .map((l) => {
      const last = l.messages[0];
      const when = last?.deliveredAt ?? l.updatedAt;
      const { role, company } = splitHeadline(l.jobTitle);
      return {
        id: l.id,
        firstName: l.firstName,
        lastName: l.lastName,
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
        when: relativeTime(when),
        whenTs: when.getTime(),
      };
    })
    .sort((a, b) => b.whenTs - a.whenTs);
}
