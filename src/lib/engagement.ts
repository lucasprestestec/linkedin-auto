import type { Settings } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  acceptInvitation,
  archiveThread,
  extractReceivedInvitations,
  extractSentInvitations,
  followProfile,
  visitProfile,
  withdrawInvitation,
} from "@/lib/edges";
import { findLeadByProfileUrl } from "@/lib/leads";
import { linkedinProfileSlug, normalizeLinkedinUrl } from "@/lib/linkedin";
import { isExcluded, parseExclusionList } from "@/lib/exclusion";

// Ações Engagement opcionais, cada uma com chave própria em Ajustes (todas
// desligadas por padrão). Nenhuma manda mensagem; rodam dentro do horário de
// trabalho, junto da etapa proativa do cron.

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const MAX_PER_RUN = 10;

export interface EngagementResult {
  invitesAccepted: number;
  invitesWithdrawn: number;
  threadsArchived: number;
}

// Convites recebidos viram leads "aguardando resposta": a IA abre a conversa
// na sequência (mensagem de abertura). No máximo 1x/hora, até 10 por rodada.
// Dois passos: lista os convites pendentes (quem convidou + urn/secret) e
// aceita um a um. Quem está na lista de exclusão não é aceito — fica pro
// corretor decidir no LinkedIn.
async function acceptInvites(identityId: string, settings: Settings): Promise<number> {
  if (!settings.acceptInvitesEnabled) return 0;
  if (Date.now() - (settings.receivedInvitesCheckedAt?.getTime() ?? 0) < HOUR_MS) return 0;
  await prisma.settings.update({ where: { id: "singleton" }, data: { receivedInvitesCheckedAt: new Date() } });

  const rules = parseExclusionList(settings.exclusionList);
  let created = 0;
  let attempts = 0;
  for (const inv of await extractReceivedInvitations(identityId)) {
    if (attempts >= MAX_PER_RUN) break;
    if (!inv.linkedin_invitation_urn || !inv.linkedin_invitation_secret) continue;
    const url =
      (inv.linkedin_profile_url && normalizeLinkedinUrl(inv.linkedin_profile_url)) ||
      (inv.linkedin_profile_handle ? normalizeLinkedinUrl(`https://www.linkedin.com/in/${inv.linkedin_profile_handle}`) : null);
    const lead = {
      linkedinProfileUrl: url,
      firstName: inv.first_name ?? null,
      lastName: inv.last_name ?? null,
      jobTitle: inv.job_title ?? inv.headline ?? null,
    };
    if (isExcluded({ ...lead, headline: lead.jobTitle }, rules)) continue;

    attempts++;
    try {
      await acceptInvitation(identityId, inv.linkedin_invitation_urn, inv.linkedin_invitation_secret);
    } catch (err) {
      console.error("Falha ao aceitar convite", inv.linkedin_invitation_urn, err);
      continue;
    }
    // Aceito; vira lead se tiver perfil e ainda não for lead.
    if (!url || (await findLeadByProfileUrl(url))) continue;
    await prisma.lead.create({
      data: {
        ...lead,
        linkedinProfileUrl: url,
        linkedinProfileId: inv.linkedin_profile_id != null ? String(inv.linkedin_profile_id) : null,
        status: "WAITING_REPLY",
        tags: ["convite recebido"],
      },
    });
    created++;
  }
  return created;
}

// Convite sem resposta há muito tempo pesa contra a conta no LinkedIn:
// retira e marca o lead como sem resposta. No máximo 1x/dia.
// Retirar exige o URN do convite, que vem da lista de convites enviados.
async function withdrawStaleInvites(identityId: string, settings: Settings): Promise<number> {
  if (!settings.withdrawInvitesEnabled) return 0;
  if (Date.now() - (settings.withdrawCheckedAt?.getTime() ?? 0) < DAY_MS) return 0;
  await prisma.settings.update({ where: { id: "singleton" }, data: { withdrawCheckedAt: new Date() } });

  const cutoff = new Date(Date.now() - settings.withdrawAfterDays * DAY_MS);
  const stale = await prisma.lead.findMany({
    where: { status: "INVITE_SENT", invitedAt: { lt: cutoff } },
    orderBy: { invitedAt: "asc" },
    take: MAX_PER_RUN,
  });
  if (stale.length === 0) return 0;

  const urnBySlug = new Map<string, string>();
  for (const inv of await extractSentInvitations(identityId)) {
    const slug =
      (inv.linkedin_profile_url && linkedinProfileSlug(inv.linkedin_profile_url)) || inv.linkedin_profile_handle?.trim().toLowerCase();
    if (slug && inv.linkedin_invitation_urn) urnBySlug.set(slug, inv.linkedin_invitation_urn);
  }

  let withdrawn = 0;
  for (const lead of stale) {
    const urn = urnBySlug.get(linkedinProfileSlug(lead.linkedinProfileUrl) ?? "");
    // Sem convite pendente na lista: já foi aceito/recusado — o fluxo normal cuida.
    if (!urn) continue;
    try {
      await withdrawInvitation(identityId, urn);
      await prisma.lead.update({ where: { id: lead.id }, data: { status: "LOST", needsHumanReason: null } });
      withdrawn++;
    } catch (err) {
      console.error("Falha ao retirar convite", lead.linkedinProfileUrl, err);
    }
  }
  return withdrawn;
}

// Lead perdido: arquiva a conversa no LinkedIn pra caixa de entrada ficar limpa.
async function archiveLostThreads(identityId: string, settings: Settings): Promise<number> {
  if (!settings.archiveLostEnabled) return 0;
  const lost = await prisma.lead.findMany({
    where: { status: "LOST", linkedinThreadId: { not: null }, archivedAt: null },
    take: MAX_PER_RUN,
  });
  let archived = 0;
  for (const lead of lost) {
    try {
      await archiveThread(identityId, lead.linkedinThreadId!);
      await prisma.lead.update({ where: { id: lead.id }, data: { archivedAt: new Date() } });
      archived++;
    } catch (err) {
      console.error("Falha ao arquivar conversa", lead.linkedinThreadId, err);
    }
  }
  return archived;
}

export async function runEngagement(identityId: string, settings: Settings): Promise<EngagementResult> {
  const result: EngagementResult = { invitesAccepted: 0, invitesWithdrawn: 0, threadsArchived: 0 };
  // Cada uma isolada: se a ação não existir/mudar, as outras seguem.
  try {
    result.invitesAccepted = await acceptInvites(identityId, settings);
  } catch (err) {
    console.error("Falha ao aceitar convites recebidos", err);
  }
  try {
    result.invitesWithdrawn = await withdrawStaleInvites(identityId, settings);
  } catch (err) {
    console.error("Falha ao retirar convites antigos", err);
  }
  try {
    result.threadsArchived = await archiveLostThreads(identityId, settings);
  } catch (err) {
    console.error("Falha ao arquivar conversas", err);
  }
  return result;
}

// Aquecimento: visita e segue o perfil antes do convite — a pessoa vê
// "fulano visitou seu perfil" e tende a aceitar mais. Falha não impede o convite.
export async function warmUpProfiles(identityId: string, profileUrls: string[]): Promise<number> {
  let warmed = 0;
  const CONCURRENCY = 3;
  for (let i = 0; i < profileUrls.length; i += CONCURRENCY) {
    const batch = profileUrls.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async (url) => {
        await visitProfile(identityId, url);
        await followProfile(identityId, url);
      }),
    );
    results.forEach((r, j) => {
      if (r.status === "fulfilled") warmed++;
      else console.error("Falha ao aquecer perfil", batch[j], r.reason);
    });
  }
  return warmed;
}

