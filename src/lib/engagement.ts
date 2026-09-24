import type { Settings } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  acceptReceivedInvitations,
  archiveThread,
  followProfile,
  threadUrl,
  visitProfile,
  withdrawInvitation,
} from "@/lib/edges";
import { findLeadByProfileUrl } from "@/lib/leads";
import { normalizeLinkedinUrl } from "@/lib/linkedin";
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
// na sequência (mensagem de abertura). No máximo 1x/hora.
async function acceptInvites(identityId: string, settings: Settings): Promise<number> {
  if (!settings.acceptInvitesEnabled) return 0;
  if (Date.now() - (settings.receivedInvitesCheckedAt?.getTime() ?? 0) < HOUR_MS) return 0;
  await prisma.settings.update({ where: { id: "singleton" }, data: { receivedInvitesCheckedAt: new Date() } });

  const rules = parseExclusionList(settings.exclusionList);
  let created = 0;
  for (const person of await acceptReceivedInvitations(identityId)) {
    const url =
      (person.linkedin_profile_url && normalizeLinkedinUrl(person.linkedin_profile_url)) ||
      (person.linkedin_profile_handle ? normalizeLinkedinUrl(`https://www.linkedin.com/in/${person.linkedin_profile_handle}`) : null);
    if (!url || (await findLeadByProfileUrl(url))) continue;
    const lead = {
      linkedinProfileUrl: url,
      firstName: person.first_name ?? null,
      lastName: person.last_name ?? null,
      jobTitle: person.job_title ?? person.headline ?? null,
    };
    // Aceitar a conexão tudo bem; só não entra no funil automático.
    if (isExcluded({ ...lead, headline: lead.jobTitle }, rules)) continue;
    await prisma.lead.create({
      data: {
        ...lead,
        linkedinProfileId: person.linkedin_profile_id != null ? String(person.linkedin_profile_id) : null,
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
  let withdrawn = 0;
  for (const lead of stale) {
    try {
      await withdrawInvitation(identityId, lead.linkedinProfileUrl);
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
      await archiveThread(identityId, threadUrl({ linkedin_thread_id: lead.linkedinThreadId! }));
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

