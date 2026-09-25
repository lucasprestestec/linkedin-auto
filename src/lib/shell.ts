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
}

export async function getShellData(): Promise<ShellData> {
  const [settings, urgent] = await Promise.all([
    prisma.settings.findUnique({ where: { id: "singleton" }, select: { ownerName: true, automationPaused: true } }),
    prisma.lead.findMany({
      where: { status: "NEEDS_HUMAN" },
      orderBy: { updatedAt: "desc" },
      select: { id: true, firstName: true, lastName: true, needsHumanReason: true, updatedAt: true },
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
  };
}

// "Lucas Almeida" -> "Lucas"
export function firstNameOf(name: string | null): string | null {
  return name?.trim().split(/\s+/)[0] || null;
}
