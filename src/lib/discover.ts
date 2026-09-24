import { prisma } from "@/lib/prisma";
import { searchProspects, inviteProspects } from "@/lib/prospect";

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

  const results = await searchProspects(settings.targetAudience);
  const candidates = results.filter((r) => !r.alreadyLead);

  if (candidates.length === 0) {
    return { scheduled: 0, found: results.length };
  }

  const { scheduled } = await inviteProspects(candidates);
  return { scheduled, found: results.length };
}
