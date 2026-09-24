import { prisma } from "@/lib/prisma";
import { scheduleConnectionInvites } from "@/lib/edges";
import { getActiveIdentityId } from "@/lib/identity";
import { linkedinProfileSlug, normalizeLinkedinUrl } from "@/lib/linkedin";

// Descoberta fria fica fora da edges.run: buscar perfil novo custa crédito lá
// (e o piso pago, US$110/mês, não fecha conta pro volume de um corretor só).
// O corretor busca de graça direto no LinkedIn (URL montada por lib/linkedin.ts)
// e cola os links de quem escolheu de volta aqui — daqui pra frente é tudo
// automático de novo: convite (grátis, Engagement Identity) e resposta do
// agente de IA.

export interface ProspectResult {
  linkedinProfileUrl: string;
  alreadyLead: boolean;
}

export async function parsePastedProfiles(raw: string): Promise<ProspectResult[]> {
  const urls = new Set<string>();
  for (const line of raw.split(/\s+/)) {
    const normalized = normalizeLinkedinUrl(line);
    if (normalized) urls.add(normalized);
  }

  // Compara pelo perfil, não pela string: leads antigos podem estar gravados
  // com a URL escrita de outro jeito.
  const existing = await prisma.lead.findMany({ select: { linkedinProfileUrl: true } });
  const known = new Set(existing.map((l) => linkedinProfileSlug(l.linkedinProfileUrl)));

  return Array.from(urls).map((url) => ({ linkedinProfileUrl: url, alreadyLead: known.has(linkedinProfileSlug(url)) }));
}

export async function remainingDailyInviteQuota(): Promise<number> {
  const settings = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } });
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  // Conta pelo momento do convite, não pelo status: com a detecção de aceite,
  // um convite de hoje pode já ter virado WAITING_REPLY e não pode liberar vaga.
  const invitedToday = await prisma.lead.count({
    where: { invitedAt: { gte: startOfDay } },
  });
  return settings.dailyInviteLimit - invitedToday;
}

// Convite sem nota, em modo async — a edges.run espaça/limita as chamadas por
// conta própria. Corta a lista no limite diário restante; quem sobra fica de
// fora silenciosamente (o chamador informa ao usuário quantos ficaram de fora).
export async function inviteProspects(
  candidates: { linkedinProfileUrl: string; fullName?: string; jobTitle?: string }[],
): Promise<{ scheduled: number; skippedForLimit: number }> {
  const remaining = await remainingDailyInviteQuota();
  if (remaining <= 0) {
    return { scheduled: 0, skippedForLimit: candidates.length };
  }

  const toInvite = candidates.slice(0, remaining);
  const skippedForLimit = candidates.length - toInvite.length;
  if (toInvite.length === 0) {
    return { scheduled: 0, skippedForLimit };
  }

  const appUrl = process.env.APP_URL;
  if (!appUrl) throw new Error("APP_URL não configurado — necessário para o callback da edges.run.");

  const identityId = await getActiveIdentityId();
  await scheduleConnectionInvites(
    identityId,
    // Nome e cargo voltam no callback (custom_data) e viram o lead já identificado.
    toInvite.map((c) => ({ linkedin_profile_url: c.linkedinProfileUrl, full_name: c.fullName, job_title: c.jobTitle })),
    `${appUrl}/api/webhooks/edges`,
  );

  return { scheduled: toInvite.length, skippedForLimit };
}
