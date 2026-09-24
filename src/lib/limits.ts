import { prisma } from "@/lib/prisma";

// Mensagens que saíram da conta hoje (agente + corretor) — base do limite
// diário de mensagens, que protege a conta do LinkedIn.
export async function messagesSentToday(): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  return prisma.message.count({
    where: { sender: { not: "LEAD" }, createdAt: { gte: startOfDay } },
  });
}
