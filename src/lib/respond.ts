import { prisma } from "@/lib/prisma";
import { markNeedsHuman } from "@/lib/handoff";
import { sendMessage } from "@/lib/edges";
import { decideResponse } from "@/lib/agent";
import { messagesSentToday } from "@/lib/limits";
import { instructionsFor } from "@/lib/campaigns";
import { isExcluded, parseExclusionList } from "@/lib/exclusion";
import type { Lead } from "@prisma/client";

// Chamado depois que uma mensagem nova do lead é gravada no banco.
// Decide: responder automaticamente, ou marcar NEEDS_HUMAN com o motivo certo.
export async function handleIncomingMessage(lead: Lead, identityId: string) {
  const settings = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } });

  if (settings.automationPaused) {
    await markNeedsHuman(lead.id, "Automação pausada — responda manualmente");
    return;
  }

  if (isExcluded({ ...lead, headline: lead.jobTitle }, parseExclusionList(settings.exclusionList))) {
    await markNeedsHuman(lead.id, "Está na lista de exclusão — a IA não responde");
    return;
  }

  if ((await messagesSentToday()) >= settings.dailyMessageLimit) {
    await markNeedsHuman(lead.id, "Limite diário de mensagens atingido");
    return;
  }

  const [history, campaign] = await Promise.all([
    prisma.message.findMany({
      where: { leadId: lead.id },
      orderBy: { deliveredAt: "asc" },
      select: { sender: true, content: true, deliveredAt: true },
    }),
    lead.campaignId ? prisma.campaign.findUnique({ where: { id: lead.campaignId }, select: { name: true } }) : null,
  ]);

  let decision;
  try {
    decision = await decideResponse({
      instructions: await instructionsFor(lead, settings),
      history,
      lead: { ...lead, campaignName: campaign?.name ?? null },
    });
    // Fica nos logs da Vercel: por que o agente fez o que fez.
    console.log(
      `[agente] lead=${lead.id} modelo=${decision.model} ação=${decision.action} tentativas=${decision.attempts} ` +
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
    const result = await sendMessage(identityId, lead.linkedinProfileUrl, decision.message);
    await prisma.message.create({
      data: {
        leadId: lead.id,
        sender: "AGENT",
        content: decision.message,
        linkedinMessageId: result.linkedin_message_id,
        deliveredAt: new Date(result.delivered_at),
      },
    });
    await prisma.lead.update({
      where: { id: lead.id },
      // Recusou: encerra (sem follow-up). Quer avançar: qualificado.
      data: { status: decision.declined ? "LOST" : decision.qualified ? "QUALIFIED" : "CONVERSATION_OPEN", needsHumanReason: null },
    });
  } catch (err) {
    await markNeedsHuman(lead.id, `Falha ao enviar mensagem: ${err instanceof Error ? err.message : "erro desconhecido"}`);
  }
}

