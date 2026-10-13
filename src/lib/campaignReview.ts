import type { Campaign, Settings } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Revisão de campanha nova: nas primeiras semanas (e mensagens) de cada
// campanha, tudo o que a secretária escreve passa pelo corretor, mesmo com a
// aprovação geral desligada. Sai da revisão só quando completa os DOIS: os
// dias desde a criação e as mensagens enviadas — o que acontecer depois.

export interface ReviewState {
  inReview: boolean;
  sent: number;
  messages: number;
  // Fim do prazo em dias (a revisão pode continuar depois, até as mensagens).
  until: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function reviewStateOf(
  campaign: Pick<Campaign, "id" | "createdAt" | "reviewReleasedAt">,
  settings: Pick<Settings, "campaignReview" | "campaignReviewDays" | "campaignReviewMessages">,
): Promise<ReviewState> {
  const until = new Date(campaign.createdAt.getTime() + settings.campaignReviewDays * DAY_MS);
  const sent = await prisma.message.count({ where: { sender: "AGENT", lead: { campaignId: campaign.id } } });
  const inReview = settings.campaignReview && !campaign.reviewReleasedAt && (Date.now() < until.getTime() || sent < settings.campaignReviewMessages);
  return { inReview, sent, messages: settings.campaignReviewMessages, until };
}

// Motivo curto pra aparecer na aprovação, ou null se a campanha do lead não
// está em revisão.
export async function campaignReviewNote(campaignId: string | null): Promise<string | null> {
  if (!campaignId) return null;
  const [settings, campaign] = await Promise.all([
    prisma.settings.findUniqueOrThrow({ where: { id: "singleton" }, select: { campaignReview: true, campaignReviewDays: true, campaignReviewMessages: true } }),
    prisma.campaign.findUnique({ where: { id: campaignId }, select: { id: true, name: true, createdAt: true, reviewReleasedAt: true } }),
  ]);
  if (!campaign || !settings.campaignReview || campaign.reviewReleasedAt) return null;
  const state = await reviewStateOf(campaign, settings);
  if (!state.inReview) return null;
  return `Campanha nova em revisão ("${campaign.name}": ${state.sent} de ${state.messages} mensagens, prazo até ${state.until.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" })})`;
}
