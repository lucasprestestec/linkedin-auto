import { prisma } from "@/lib/prisma";

// Mensagens que saíram da conta hoje (agente + corretor) — base do limite
// diário de mensagens, que protege a conta do LinkedIn.
export async function messagesSentToday(): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  return prisma.message.count({
    // Só LinkedIn: o limite existe pra proteger a conta de lá. E-mail sai da
    // caixa do próprio corretor e não conta.
    where: { sender: { not: "LEAD" }, channel: "LINKEDIN", createdAt: { gte: startOfDay } },
  });
}

// E-mails que a conta mandou hoje — base do limite diário do canal de e-mail.
export async function emailsSentToday(): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  return prisma.message.count({ where: { sender: { not: "LEAD" }, channel: "EMAIL", createdAt: { gte: startOfDay } } });
}

// WhatsApp enviado hoje pela secretária/corretor — base do limite diário do canal.
export async function whatsappSentToday(): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  return prisma.message.count({ where: { sender: { not: "LEAD" }, channel: "WHATSAPP", createdAt: { gte: startOfDay } } });
}
