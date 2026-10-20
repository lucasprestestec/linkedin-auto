import { prisma } from "@/lib/prisma";
import { hotScore, hotSignals, type Signal } from "@/lib/hotSignals";

export interface HotLead {
  id: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  status: string;
  when: Date;
  score: number;
  signals: Signal[];
}

// "Mais quentes": quem tem sinais concretos de interesse, com o motivo. Só olha as conversas em andamento
// (quem já tem reunião marcada aparece em "Próxima reunião"); 150 mais mexidas bastam para o topo do painel.
export async function getHotLeads(limit = 3, now = new Date()): Promise<HotLead[]> {
  const leads = await prisma.lead.findMany({
    where: { status: { in: ["NEEDS_HUMAN", "QUALIFIED", "CONVERSATION_OPEN"] }, doNotContact: false, otherAiActive: false },
    orderBy: { updatedAt: "desc" },
    take: 150,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      status: true,
      jobTitle: true,
      messages: { orderBy: { deliveredAt: "desc" }, take: 12, select: { sender: true, content: true, deliveredAt: true, openCount: true } },
    },
  });
  return leads
    .map((l) => {
      const messages = l.messages.reverse().map((m) => ({ sender: m.sender, content: m.content, at: m.deliveredAt, openCount: m.openCount }));
      const signals = hotSignals({ status: l.status, jobTitle: l.jobTitle, messages, now });
      return { id: l.id, firstName: l.firstName, lastName: l.lastName, avatarUrl: l.avatarUrl, status: l.status, when: messages.at(-1)?.at ?? new Date(0), score: hotScore(signals), signals };
    })
    .filter((l) => l.score > 0)
    .sort((a, b) => b.score - a.score || b.when.getTime() - a.when.getTime())
    .slice(0, limit);
}
