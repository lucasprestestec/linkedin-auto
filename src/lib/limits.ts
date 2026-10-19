import type { Settings } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { startOfDaySP } from "@/lib/mailboxPolicy";

// Limites diários em vigor. É o ÚNICO lugar que decide quanto cada canal pode mandar por dia:
// quem envia (robô, fila de aprovados, convites, lembretes) lê daqui, nunca direto de Settings.
// Hoje vêm da configuração do cliente; quando existirem planos (limites maiores ou menores por
// plano), é só trocar o corpo desta função para olhar o plano do cliente.
export interface DailyLimits {
  invites: number;
  linkedinMessages: number;
  email: number;
  whatsapp: number;
}

export type LimitSettings = Pick<Settings, "dailyInviteLimit" | "dailyMessageLimit" | "dailyEmailLimit" | "dailyWhatsappLimit" | "dailyInviteMax" | "dailyMessageMax">;

export function effectiveLimits(settings: LimitSettings): DailyLimits {
  return {
    // O teto (definido pelo dono) vale também na hora de enviar, não só ao salvar a tela de Ajustes.
    invites: Math.min(settings.dailyInviteLimit, settings.dailyInviteMax),
    linkedinMessages: Math.min(settings.dailyMessageLimit, settings.dailyMessageMax),
    email: settings.dailyEmailLimit,
    whatsapp: settings.dailyWhatsappLimit,
  };
}

// O dia dos limites é o de Brasília (o mesmo do expediente), não o do servidor.
// Mensagens que saíram da conta hoje (agente + corretor) — base do limite
// diário de mensagens, que protege a conta do LinkedIn.
export async function messagesSentToday(): Promise<number> {
  return prisma.message.count({
    // Só LinkedIn: o limite existe pra proteger a conta de lá. E-mail sai da
    // caixa do próprio corretor e não conta.
    where: { sender: { not: "LEAD" }, channel: "LINKEDIN", createdAt: { gte: startOfDaySP(new Date()) } },
  });
}

// E-mails que a conta mandou hoje — base do limite diário do canal de e-mail.
export async function emailsSentToday(): Promise<number> {
  return prisma.message.count({ where: { sender: { not: "LEAD" }, channel: "EMAIL", createdAt: { gte: startOfDaySP(new Date()) } } });
}

// WhatsApp enviado hoje pela secretária/corretor — base do limite diário do canal.
export async function whatsappSentToday(): Promise<number> {
  return prisma.message.count({ where: { sender: { not: "LEAD" }, channel: "WHATSAPP", createdAt: { gte: startOfDaySP(new Date()) } } });
}
