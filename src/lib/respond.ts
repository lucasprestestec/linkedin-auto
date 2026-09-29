import { prisma } from "@/lib/prisma";
import { markNeedsHuman } from "@/lib/handoff";
import { decideResponse } from "@/lib/agent";
import { messagesSentToday } from "@/lib/limits";
import { instructionsFor } from "@/lib/campaigns";
import { isExcluded, parseExclusionList } from "@/lib/exclusion";
import { deliver, supersedeDrafts } from "@/lib/outbox";
import type { Lead } from "@prisma/client";

// Chamado depois que uma mensagem nova do lead é gravada no banco.
// Decide: responder automaticamente (no MESMO canal em que ele escreveu), ou
// marcar NEEDS_HUMAN com o motivo certo.
export async function handleIncomingMessage(lead: Lead, identityId: string | null) {
  const settings = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } });

  // O lead escreveu: qualquer mensagem que esperava aprovação ficou velha.
  await supersedeDrafts(lead.id);

  // Reunião já marcada: remarcar, cancelar ou qualquer assunto novo é com o corretor.
  if (lead.status === "MEETING_SCHEDULED") {
    await markNeedsHuman(lead.id, "Escreveu depois de a reunião ser marcada");
    return;
  }

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

  const bookingUrl = settings.bookingUrl?.trim() || null;

  let decision;
  try {
    decision = await decideResponse({
      instructions: await instructionsFor(lead, settings),
      history,
      channel,
      lead: { ...lead, campaignName: campaign?.name ?? null },
      bookingAvailable: Boolean(bookingUrl),
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

  // O modelo só marca "oferecer agenda"; o link em si é sempre o configurado, anexado aqui.
  // Nunca duas vezes para o mesmo lead.
  const offerBooking = decision.offerBooking && Boolean(bookingUrl) && !lead.bookingLinkSentAt && !decision.declined;
  const message = offerBooking ? `${decision.message}\n\n${bookingUrl}` : decision.message;

  try {
    await deliver(lead, channel, message, {
      identityId,
      kind: "REPLY",
      reason: offerBooking ? `${decision.analysis} (com o link da agenda)` : decision.analysis,
      approval: settings.approvalMode,
      // Recusou: encerra (sem follow-up). Quer avançar (ou recebeu a agenda): qualificado.
      effects: {
        status: decision.declined ? "LOST" : decision.qualified || offerBooking ? "QUALIFIED" : "CONVERSATION_OPEN",
        needsHumanReason: null,
        nextStep: offerBooking ? "Mandei o link da agenda; aguardando o lead marcar." : null,
        nextStepAt: null,
        ...(offerBooking ? { bookingLinkSentAt: new Date() } : {}),
      },
    });
  } catch (err) {
    await markNeedsHuman(lead.id, `Falha ao enviar mensagem: ${err instanceof Error ? err.message : "erro desconhecido"}`);
  }
}
