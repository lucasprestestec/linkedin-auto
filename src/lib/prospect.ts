import { prisma } from "@/lib/prisma";
import { scheduleConnectionInvites } from "@/lib/edges";
import { getActiveIdentityId } from "@/lib/identity";
import { linkedinProfileSlug, normalizeLinkedinUrl } from "@/lib/linkedin";
import { isExcluded, loadExclusionRules } from "@/lib/exclusion";
import { warmUpProfiles } from "@/lib/engagement";
import { effectiveLimits } from "@/lib/limits";
import { startOfDaySP } from "@/lib/mailboxPolicy";

// Descoberta fria fica fora da edges.run: buscar perfil novo custa crédito lá
// (e o piso pago, US$110/mês, não fecha conta pro volume de um corretor só).
// O corretor busca de graça direto no LinkedIn (URL montada por lib/linkedin.ts)
// e cola os links de quem escolheu de volta aqui — daqui pra frente é tudo
// automático de novo: convite (grátis, Engagement Identity) e resposta do
// agente de IA.

export interface ProspectResult {
  linkedinProfileUrl: string;
  alreadyLead: boolean;
  // Está na lista de exclusão (Ajustes) — não pode ser convidado.
  excluded?: boolean;
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

  const rules = await loadExclusionRules();
  return Array.from(urls).map((url) => ({
    linkedinProfileUrl: url,
    alreadyLead: known.has(linkedinProfileSlug(url)),
    excluded: isExcluded({ linkedinProfileUrl: url }, rules),
  }));
}

// Pedido que a edges.run não confirmou em 3 dias deixa de ocupar vaga (o retorno se perdeu).
const PENDING_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

export async function remainingDailyInviteQuota(): Promise<number> {
  const settings = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } });
  const startOfDay = startOfDaySP(new Date());
  await prisma.inviteScheduled.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - PENDING_MAX_AGE_MS) } } });
  // Conta pelo momento do convite, não pelo status: com a detecção de aceite,
  // um convite de hoje pode já ter virado WAITING_REPLY e não pode liberar vaga.
  // Convite pedido e ainda sem retorno da edges.run também ocupa vaga (mesmo o de ontem à noite),
  // salvo o que já tem lead com convite de hoje (contato criado à mão): esse já está em invitedToday.
  const [invitedToday, pending] = await Promise.all([
    prisma.lead.findMany({ where: { invitedAt: { gte: startOfDay } }, select: { linkedinProfileUrl: true } }),
    prisma.inviteScheduled.findMany({ select: { profileUrl: true } }),
  ]);
  const counted = new Set(invitedToday.map((l) => linkedinProfileSlug(l.linkedinProfileUrl)));
  const pendingOnly = pending.filter((p) => !counted.has(linkedinProfileSlug(p.profileUrl))).length;
  return effectiveLimits(settings).invites - invitedToday.length - pendingOnly;
}

// Convite sem nota, em modo async — a edges.run espaça/limita as chamadas por
// conta própria. Corta a lista no limite diário restante; quem sobra fica de
// fora silenciosamente (o chamador informa ao usuário quantos ficaram de fora).
export async function inviteProspects(
  candidates: { linkedinProfileUrl: string; fullName?: string; jobTitle?: string; icpScore?: number; campaignId?: string }[],
): Promise<{ scheduled: number; skippedForLimit: number }> {
  // Última barreira: ninguém da lista de exclusão recebe convite, venha de onde vier.
  const rules = await loadExclusionRules();
  candidates = candidates.filter((c) => {
    const [firstName, ...rest] = (c.fullName ?? "").split(" ");
    return !isExcluded({ linkedinProfileUrl: c.linkedinProfileUrl, firstName, lastName: rest.join(" "), headline: c.jobTitle }, rules);
  });

  const appUrl = process.env.APP_URL;
  if (!appUrl) throw new Error("APP_URL não configurado — necessário para o callback da edges.run.");
  const identityId = await getActiveIdentityId();

  // Escolhe quem entra e reserva as vagas numa tacada só, com trava no banco: dois lotes ao mesmo tempo
  // não enxergam a mesma vaga, e o mesmo perfil não é pedido duas vezes enquanto o retorno não chega.
  const { toInvite, skippedForLimit } = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(73002)`;

    // Campanha pausada/finalizada não recebe gente nova; limite de pessoas da
    // campanha (se houver) corta o excedente.
    const campaignIds = [...new Set(candidates.map((c) => c.campaignId).filter((id): id is string => Boolean(id)))];
    for (const id of campaignIds) {
      const campaign = await prisma.campaign.findUnique({ where: { id }, select: { status: true, maxLeads: true, _count: { select: { leads: true } } } });
      if (!campaign || campaign.status !== "ACTIVE") throw new Error("Essa campanha está pausada ou finalizada. Reative-a para convidar pessoas.");
      if (campaign.maxLeads != null) {
        const pendingInCampaign = await prisma.inviteScheduled.count({ where: { campaignId: id } });
        let room = Math.max(0, campaign.maxLeads - campaign._count.leads - pendingInCampaign);
        if (room === 0) throw new Error(`A campanha já chegou ao limite de ${campaign.maxLeads} pessoas.`);
        candidates = candidates.filter((c) => c.campaignId !== id || room-- > 0);
      }
    }

    // Quem já tem pedido em andamento não é pedido de novo.
    const key = (u: string) => normalizeLinkedinUrl(u) ?? u;
    const already = new Set((await prisma.inviteScheduled.findMany({ select: { profileUrl: true } })).map((p) => p.profileUrl));
    candidates = candidates.filter((c) => !already.has(key(c.linkedinProfileUrl)));

    const remaining = await remainingDailyInviteQuota();
    const chosen = remaining > 0 ? candidates.slice(0, remaining) : [];
    if (chosen.length > 0) {
      await tx.inviteScheduled.createMany({ data: chosen.map((c) => ({ profileUrl: key(c.linkedinProfileUrl), campaignId: c.campaignId ?? null })), skipDuplicates: true });
    }
    return { toInvite: chosen, skippedForLimit: candidates.length - chosen.length };
  });
  if (toInvite.length === 0) return { scheduled: 0, skippedForLimit };

  try {
    // Aquecimento opcional (Ajustes): visita + segue antes do convite.
    const settings = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" }, select: { warmupEnabled: true } });
    if (settings.warmupEnabled) await warmUpProfiles(identityId, toInvite.map((c) => c.linkedinProfileUrl));

    await scheduleConnectionInvites(
      identityId,
      // Nome e cargo voltam no callback (custom_data) e viram o lead já identificado.
      toInvite.map((c) => ({
        linkedin_profile_url: c.linkedinProfileUrl,
        full_name: c.fullName,
        job_title: c.jobTitle,
        icp_score: c.icpScore,
        campaign_id: c.campaignId,
      })),
      `${appUrl}/api/webhooks/edges`,
    );
  } catch (err) {
    // Não saiu nada: devolve as vagas reservadas.
    await prisma.inviteScheduled.deleteMany({ where: { profileUrl: { in: toInvite.map((c) => normalizeLinkedinUrl(c.linkedinProfileUrl) ?? c.linkedinProfileUrl) } } });
    throw err;
  }

  return { scheduled: toInvite.length, skippedForLimit };
}
