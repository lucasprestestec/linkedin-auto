import { prisma } from "@/lib/prisma";
import { markNeedsHuman } from "@/lib/handoff";
import { decideResponse } from "@/lib/agent";
import { effectiveLimits, messagesSentToday } from "@/lib/limits";
import { instructionsFor } from "@/lib/campaigns";
import { isExcluded, parseExclusionList } from "@/lib/exclusion";
import { deliver, supersedeDrafts } from "@/lib/outbox";
import { loadCalendarContext } from "@/lib/scheduling";
import { formatSlot, slotIso } from "@/lib/slots";
import type { Lead } from "@prisma/client";
import { decideAudio, parseVoiceSettings } from "@/lib/voice/settings";
import { voiceServiceReady } from "@/lib/voice/engine";
import { publicBaseUrl } from "@/lib/voice/outgoingAudio";

// Chamado depois que uma mensagem nova do lead é gravada no banco.
// Decide: responder automaticamente (no MESMO canal em que ele escreveu), ou
// marcar NEEDS_HUMAN com o motivo certo.
export async function handleIncomingMessage(lead: Lead, identityId: string | null) {
  const settings = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } });

  // O lead escreveu: qualquer mensagem que esperava aprovação ficou velha.
  await supersedeDrafts(lead.id);

  // Quem pediu para não receber mais, ou a conversa que o corretor assumiu: a IA não responde.
  // (O corretor devolve a conversa pelo botão "Devolver ao assistente".)
  if (lead.doNotContact || lead.status === "NEEDS_HUMAN") return;

  // Outra IA (ex.: a Sofia) está com essa pessoa: a secretária não entra em nenhum canal.
  if (lead.otherAiActive) {
    await markNeedsHuman(lead.id, "Está em conversa com outra IA (ex.: Sofia): a secretária não responde");
    return;
  }

  // Reunião já marcada: remarcar, cancelar ou qualquer assunto novo é com o corretor.
  if (lead.status === "MEETING_SCHEDULED") {
    await markNeedsHuman(lead.id, "Escreveu depois de a reunião ser marcada");
    return;
  }

  const [history, campaign] = await Promise.all([
    prisma.message.findMany({
      where: { leadId: lead.id },
      orderBy: { deliveredAt: "asc" },
      select: { sender: true, content: true, deliveredAt: true, channel: true, openToken: true, openCount: true, mediaKind: true },
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

  // O assistente escreve como o corretor e se apresenta pelo nome cadastrado: sem ele, não responde.
  if (!settings.ownerName?.trim()) {
    await markNeedsHuman(lead.id, "Falta cadastrar o seu nome em Conta → Seu nome: é com ele que o assistente se apresenta");
    return;
  }

  if (isExcluded({ ...lead, headline: lead.jobTitle }, parseExclusionList(settings.exclusionList))) {
    await markNeedsHuman(lead.id, "Está na lista de exclusão — a IA não responde");
    return;
  }

  // O limite diário protege a conta do LinkedIn; e-mail não conta.
  if (channel === "LINKEDIN" && (await messagesSentToday()) >= effectiveLimits(settings).linkedinMessages) {
    await markNeedsHuman(lead.id, "Limite diário de mensagens atingido");
    return;
  }

  // Google Agenda conectado: a secretária vê os horários livres e pode marcar. Se ele
  // falhar agora, segue sem agenda (proposta de horário vai pro corretor, como antes).
  const calendar = await loadCalendarContext(settings);

  // Mensagem de voz: depende da escolha do usuario (so texto / quando o lead manda audio / sempre),
  // de a voz estar criada e autorizada e do servico de voz configurado.
  const lastInbound = [...history].reverse().find((m) => m.sender === "LEAD");
  // Assistente com nome próprio (ex.: Helena) não fala com a voz clonada do corretor: seria se passar por ele.
  // Com uma voz pronta da lista (ElevenLabs), pode falar.
  const voice = parseVoiceSettings(settings.voiceSettings);
  const wantsAudio =
    !(settings.assistantName?.trim() && voice.provider === "fish") &&
    decideAudio({ settings: voice, channel, inboundKind: lastInbound?.mediaKind, serviceReady: voiceServiceReady(voice) && Boolean(publicBaseUrl()) });

  let decision;
  try {
    decision = await decideResponse({
      instructions: await instructionsFor(lead, settings, { task: `responder à última mensagem do lead (canal ${channel})`, history }),
      history,
      channel,
      lead: { ...lead, campaignName: campaign?.name ?? null },
      calendar: calendar ?? undefined,
      asAudio: wantsAudio,
    });
    // Fica nos logs da Vercel: por que o agente fez o que fez.
    console.log(
      `[agente] lead=${lead.id} canal=${channel} modelo=${decision.model} ação=${decision.action} tentativas=${decision.attempts} ` +
        `tokens=${decision.usage.inputTokens}/${decision.usage.outputTokens} análise=(${JSON.stringify(decision.analysis).length} caracteres, não gravada nos logs)`,
    );
  } catch (err) {
    await markNeedsHuman(lead.id, `Falha no agente de IA: ${err instanceof Error ? err.message : "erro desconhecido"}`);
    return;
  }

  if (decision.action === "handoff") {
    await markNeedsHuman(lead.id, decision.reason, { silent: decision.silent, urgent: decision.urgent });
    // Urgência (sinistro, reclamação...): a pessoa não fica no silêncio. O aviso é fixo e, no modo piloto, passa pela aprovação.
    // Falha aqui não desfaz o handoff: a equipe já foi avisada acima.
    if (decision.ack) {
      await deliver(lead, channel, decision.ack, { identityId, kind: "REPLY", reason: `Aviso de encaminhamento · ${decision.reason}`, approval: settings.approvalMode, effects: {} }).catch((err) =>
        console.error(`[agente] lead=${lead.id} falha ao enviar o aviso de encaminhamento`, err),
      );
    }
    return;
  }

  try {
    // O lead escolheu um horário livre: marca no Google Agenda junto com a confirmação.
    // O evento só é criado quando a mensagem sai (aprovada, no modo piloto).
    if (decision.action === "book") {
      await deliver(lead, channel, decision.message, {
        identityId,
        kind: "REPLY",
        reason: `${decision.analysis} · Marca na sua agenda: ${formatSlot(decision.slotStart)}`,
        approval: settings.approvalMode,
        booking: { startIso: slotIso(decision.slotStart), minutes: settings.meetingMinutes },
        effects: { followUpsSent: 0 },
      });
      return;
    }

    // Ofereceu horários: qualificado, e o lembrete de 2 dias passa a valer.
    const proposed = decision.proposedSlots.length > 0 && !decision.declined;
    await deliver(lead, channel, decision.message, {
      identityId,
      kind: "REPLY",
      reason: decision.analysis,
      approval: settings.approvalMode,
      // So vai em audio se o texto cabe numa mensagem de voz (curto, sem link nem numero longo).
      asAudio: wantsAudio && decision.audioOk,
      // Em dúvida: vai pra você aprovar mesmo com a aprovação desligada.
      ...(decision.unsure ? { forceApproval: "A IA ficou em dúvida e pediu sua revisão" } : {}),
      // Recusou: encerra (sem follow-up). Quer avançar (ou recebeu horários): qualificado.
      effects: {
        status: decision.declined ? "LOST" : decision.qualified || proposed ? "QUALIFIED" : "CONVERSATION_OPEN",
        needsHumanReason: null,
        nextStep: proposed ? "Sugeri horários de reunião; aguardando o lead escolher." : null,
        nextStepAt: null,
        ...(proposed ? { slotsProposedAt: new Date() } : {}),
        // Recusou ou pediu pra parar: não volta a ser abordado, nem em campanha nova.
        ...(decision.declined ? { doNotContact: true } : {}),
      },
    });
  } catch (err) {
    await markNeedsHuman(lead.id, `Falha ao enviar mensagem: ${err instanceof Error ? err.message : "erro desconhecido"}`);
  }
}
