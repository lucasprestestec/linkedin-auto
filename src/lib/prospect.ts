import { prisma } from "@/lib/prisma";
import { searchPeople, scheduleConnectionInvites, getWorkspace, type EdgesSearchPerson } from "@/lib/edges";
import { getActiveIdentityId } from "@/lib/identity";
import { MAX_SEARCH_RESULTS } from "@/lib/prospect-constants";

// Núcleo compartilhado entre a busca automática (lib/discover.ts, 1x/dia) e a busca
// manual (app/prospect — o corretor digita o que quer e busca na hora). As duas
// via caem aqui pro limite diário e a checagem de "já é lead" nunca ficarem
// dessincronizadas entre os dois fluxos.

export type ProspectResult = EdgesSearchPerson & { alreadyLead: boolean };

export interface SearchQuota {
  creditsLeft: number;
  creditsMax: number;
  maxPerSearch: number;
  renewsAt: string | null;
}

// Busca no LinkedIn consome 1 crédito por resultado (convite/mensagem não consomem).
// O teto por busca é o menor entre MAX_SEARCH_RESULTS e o crédito que sobra na
// conta — sem isso, uma busca grande podia estourar o crédito do mês inteiro
// de uma vez.
export async function getSearchQuota(): Promise<SearchQuota> {
  const workspace = await getWorkspace();
  return {
    creditsLeft: workspace.credits_left,
    creditsMax: workspace.credits_max,
    maxPerSearch: Math.max(0, Math.min(MAX_SEARCH_RESULTS, workspace.credits_left)),
    renewsAt: workspace.current_month_end,
  };
}

export async function searchProspects(query: string, maxResults?: number): Promise<ProspectResult[]> {
  const quota = await getSearchQuota();
  if (quota.creditsLeft <= 0) {
    throw new Error("Sem crédito disponível na edges.run pra buscar este mês.");
  }

  const cappedMax = Math.min(maxResults ?? MAX_SEARCH_RESULTS, quota.maxPerSearch);

  const identityId = await getActiveIdentityId();
  const results = await searchPeople(identityId, query, cappedMax);

  const existing = await prisma.lead.findMany({ select: { linkedinProfileUrl: true } });
  const known = new Set(existing.map((l) => l.linkedinProfileUrl));

  return results.map((r) => ({ ...r, alreadyLead: known.has(r.linkedin_profile_url) }));
}

export async function remainingDailyInviteQuota(): Promise<number> {
  const settings = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } });
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const invitedToday = await prisma.lead.count({
    where: { status: "INVITE_SENT", createdAt: { gte: startOfDay } },
  });
  return settings.dailyInviteLimit - invitedToday;
}

// Convite sem nota, em modo async — ver nota em lib/discover.ts sobre o porquê.
// Corta a lista no limite diário restante; quem sobra fica de fora silenciosamente
// (o chamador informa ao usuário quantos ficaram de fora, via o retorno).
export async function inviteProspects(
  candidates: { linkedin_profile_url: string; full_name?: string; job_title?: string }[],
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
  await scheduleConnectionInvites(identityId, toInvite, `${appUrl}/api/webhooks/edges`);

  return { scheduled: toInvite.length, skippedForLimit };
}
