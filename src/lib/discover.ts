import { prisma } from "@/lib/prisma";
import { searchPeople, scheduleConnectionInvites } from "@/lib/edges";
import { getActiveIdentityId } from "@/lib/identity";

// Encontra prospects novos (LinkedIn search) e agenda convite para eles, respeitando
// o limite diário. Chamado 1x/dia pelo cron externo (cron-job.org). O convite
// sai sem nota — a edges.run derruba nota personalizada silenciosamente depois de
// 5/mês em conta Classic, então a personalização fica por conta da primeira
// mensagem do agente de IA depois que o lead aceita (ver lib/respond.ts).
export async function discoverAndInviteLeads() {
  const settings = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } });

  if (settings.automationPaused) {
    return { skipped: "automação pausada" as const };
  }
  if (!settings.targetAudience?.trim()) {
    return { skipped: "nenhum público-alvo configurado" as const };
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const invitedToday = await prisma.lead.count({
    where: { status: "INVITE_SENT", createdAt: { gte: startOfDay } },
  });
  const remaining = settings.dailyInviteLimit - invitedToday;
  if (remaining <= 0) {
    return { skipped: "limite diário de convites atingido" as const };
  }

  const identityId = await getActiveIdentityId();
  const results = await searchPeople(identityId, settings.targetAudience);

  const existing = await prisma.lead.findMany({ select: { linkedinProfileUrl: true } });
  const known = new Set(existing.map((l) => l.linkedinProfileUrl));

  const candidates = results
    .filter((r) => r.linkedin_profile_url && !known.has(r.linkedin_profile_url))
    .slice(0, remaining);

  if (candidates.length === 0) {
    return { scheduled: 0, found: results.length };
  }

  const appUrl = process.env.APP_URL;
  if (!appUrl) throw new Error("APP_URL não configurado — necessário para o callback da edges.run.");

  await scheduleConnectionInvites(
    identityId,
    candidates.map((c) => ({
      linkedin_profile_url: c.linkedin_profile_url,
      full_name: c.full_name,
      job_title: c.job_title,
    })),
    `${appUrl}/api/webhooks/edges`,
  );

  return { scheduled: candidates.length, found: results.length };
}
