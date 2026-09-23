import { prisma } from "@/lib/prisma";
import { sendMessage } from "@/lib/edges";
import { decideResponse } from "@/lib/agent";
import type { Lead } from "@prisma/client";

// Chamado depois que uma mensagem nova do lead é gravada no banco.
// Decide: responder automaticamente, ou marcar NEEDS_HUMAN com o motivo certo.
export async function handleIncomingMessage(lead: Lead, identityId: string) {
  const settings = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } });

  if (settings.automationPaused) {
    await markNeedsHuman(lead.id, "Automação pausada — responda manualmente");
    return;
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const sentToday = await prisma.message.count({
    where: { sender: { not: "LEAD" }, createdAt: { gte: startOfDay } },
  });
  if (sentToday >= settings.dailyMessageLimit) {
    await markNeedsHuman(lead.id, "Limite diário de mensagens atingido");
    return;
  }

  const history = await prisma.message.findMany({
    where: { leadId: lead.id },
    orderBy: { deliveredAt: "asc" },
    select: { sender: true, content: true },
  });

  let decision;
  try {
    decision = await decideResponse(history, settings.agentInstructions);
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
      data: { status: decision.qualified ? "QUALIFIED" : "CONVERSATION_OPEN", needsHumanReason: null },
    });
  } catch (err) {
    await markNeedsHuman(lead.id, `Falha ao enviar mensagem: ${err instanceof Error ? err.message : "erro desconhecido"}`);
  }
}

async function markNeedsHuman(leadId: string, reason: string) {
  await prisma.lead.update({
    where: { id: leadId },
    data: { status: "NEEDS_HUMAN", needsHumanReason: reason },
  });
}
