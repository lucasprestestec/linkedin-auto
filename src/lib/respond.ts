import { prisma } from "@/lib/prisma";
import { markNeedsHuman } from "@/lib/handoff";
import { decideResponse } from "@/lib/agent";
import { messagesSentToday } from "@/lib/limits";
import { instructionsFor } from "@/lib/campaigns";
import { isExcluded, parseExclusionList } from "@/lib/exclusion";
import { sendOnChannel } from "@/lib/channels";
import type { Lead } from "@prisma/client";

// Chamado depois que uma mensagem nova do lead é gravada no banco.
// Decide: responder automaticamente (no MESMO canal em que ele escreveu), ou
// marcar NEEDS_HUMAN com o motivo certo.
export async function handleIncomingMessage(lead: Lead, identityId: string | null) {
  const settings = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } });

  const [history, campaign] = await Promise.all([
    prisma.message.findMany({
      where: { leadId: lead.id },
      orderBy: { deliveredAt: "asc" },
      select: { sender: true, content: true, deliveredAt: true, channel: true, openToken: true, openCount: true },
    }),
    lead.campaignId ? prisma.campaign.findUnique({ where: { id: lead.campaignId }, select: { name: true } }) : null,
  ]);
  const channel = [...history].reverse().find((m) => m.sender === "LEAD")?.channel ?? "LINKEDIN";

  // Mensagem do LinkedIn sem conta conectada: não há por onde responder agora.
  if (channel === "LINKEDIN" && !identityId) return;

  if (settings.automationPaused) {
    await markNeedsHuman(lead.id, "Automação pausada — responda manualmente");
    return;
  }

  if (isExcluded({ ...lead, headline: lead.jobTitle }, parseExclusionList(settings.exclusionList))) {
    await markNeedsHuman(lead.id, "Está na lista de exclusão — a IA não responde");
    return;
  }

  // O limite diário protege a conta do LinkedIn; e-mail não conta.
  if (channel === "LINKEDIN" && (await messagesSentToday()) >= settings.dailyMessageLimit) {
    await markNeedsHuman(lead.id, "Limite diário de mensagens atingido");
    return;
  }

  let decision;
  try {
    decision = await decideResponse({
      instructions: await instructionsFor(lead, settings),
      history,
      channel,
      lead: { ...lead, campaignName: campaign?.name ?? null },
    });
    // Fica nos logs da Vercel: por que o agente fez o que fez.
    console.log(
      `[agente] lead=${lead.id} canal=${channel} modelo=${decision.model} ação=${decision.action} tentativas=${decision.attempts} ` +
        `tokens=${decision.usage.inputTokens}/${decision.usage.outputTokens} análise=${JSON.stringify(decision.analysis)}`,
    );
  } catch (err) {
    await markNeedsHuman(lead.id, `Falha no agente de IA: ${err instanceof Error ? err.message : "erro desconhecido"}`);
    return;
  }

  if (decision.action === "handoff") {
    await markNeedsHuman(lead.id, decision.reason);
    return;
  }

  try {
    await sendOnChannel(lead, channel, decision.message, { identityId });
    await prisma.lead.update({
      where: { id: lead.id },
      // Recusou: encerra (sem follow-up). Quer avançar: qualificado.
      data: { status: decision.declined ? "LOST" : decision.qualified ? "QUALIFIED" : "CONVERSATION_OPEN", needsHumanReason: null },
    });
  } catch (err) {
    await markNeedsHuman(lead.id, `Falha ao enviar mensagem: ${err instanceof Error ? err.message : "erro desconhecido"}`);
  }
}
