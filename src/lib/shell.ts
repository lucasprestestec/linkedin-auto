import { prisma } from "@/lib/prisma";
import { relativeTime } from "@/lib/format";

// Dados do "chrome" do painel (barra lateral, sino, menu): nome do corretor,
// quem precisa dele e quantas conversas esperam resposta.

export interface ShellNotification {
  id: string;
  name: string;
  reason: string;
  when: string;
}

export interface ShellData {
  ownerName: string | null;
  automationPaused: boolean;
  needYou: ShellNotification[];
  needYouCount: number;
  // Conversas cuja última mensagem é do lead (ninguém respondeu ainda).
  unanswered: number;
}

export async function getShellData(): Promise<ShellData> {
  const [settings, urgent, open] = await Promise.all([
    prisma.settings.findUnique({ where: { id: "singleton" }, select: { ownerName: true, automationPaused: true } }),
    prisma.lead.findMany({
      where: { status: "NEEDS_HUMAN" },
      orderBy: { updatedAt: "desc" },
      select: { id: true, firstName: true, lastName: true, needsHumanReason: true, updatedAt: true },
    }),
    prisma.lead.findMany({
      where: { status: { not: "LOST" }, messages: { some: {} } },
      select: { messages: { orderBy: { deliveredAt: "desc" }, take: 1, select: { sender: true } } },
    }),
  ]);

  return {
    ownerName: settings?.ownerName?.trim() || null,
    automationPaused: settings?.automationPaused ?? true,
    needYouCount: urgent.length,
    needYou: urgent.slice(0, 6).map((l) => ({
      id: l.id,
      name: [l.firstName, l.lastName].filter(Boolean).join(" ") || "Lead",
      reason: l.needsHumanReason ?? "Precisa da sua resposta",
      when: relativeTime(l.updatedAt),
    })),
    unanswered: open.filter((l) => l.messages[0]?.sender === "LEAD").length,
  };
}

// "Lucas Almeida" -> "Lucas"
export function firstNameOf(name: string | null): string | null {
  return name?.trim().split(/\s+/)[0] || null;
}
