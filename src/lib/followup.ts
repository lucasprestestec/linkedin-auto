import type { Lead, Settings } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { markNeedsHuman } from "@/lib/handoff";
import { extractConnections, sendMessage, type EdgesConnection } from "@/lib/edges";
import { generateFollowUp, generateOpeningMessage } from "@/lib/agent";
import { messagesSentToday } from "@/lib/limits";
import { isWithinWorkHours } from "@/lib/schedule";
import { isExcluded, parseExclusionList } from "@/lib/exclusion";
import { handleIncomingMessage } from "@/lib/respond";
import { runEngagement, type EngagementResult } from "@/lib/engagement";
import { instructionsFor } from "@/lib/campaigns";
import { linkedinProfileSlug } from "@/lib/linkedin";
import { PROACTIVE_STATUSES } from "@/lib/status";
import { followUpRuleFor } from "@/lib/followupPolicy";

// Parte proativa do cron: o agente fala primeiro e retoma conversas paradas.
// Tudo aqui usa só ações Engagement da edges.run (lista de conexões e envio
// de mensagem) e o modelo do Nous já configurado.

// Envios proativos por rodada do cron. Espalha as mensagens ao longo do dia
// (parece menos robótico) e mantém a função dentro do tempo limite.
const MAX_PROACTIVE_PER_RUN = 5;
const CONNECTIONS_CHECK_INTERVAL_MS = 60 * 60 * 1000;

export interface ProactiveResult {
  engagement?: EngagementResult;
  acceptedInvites: number;
  repliesSent: number;
  openingsSent: number;
  followUpsSent: number;
  markedLost: number;
  skipped?: string;
}

// Normaliza pra comparar mensagens: o modelo às vezes repete a mesma frase.
function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").replace(/[^\p{L}\p{N} ]/gu, "").trim();
}

// Convite aceito sem nota não gera conversa — só aparece na lista de conexões.
// Consultada no máximo 1x por hora e só se houver convite pendente.
export async function detectAcceptedInvites(identityId: string, settings: Settings): Promise<number> {
  const checkedAt = settings.connectionsCheckedAt?.getTime() ?? 0;
  if (Date.now() - checkedAt < CONNECTIONS_CHECK_INTERVAL_MS) return 0;

  const pending = await prisma.lead.findMany({ where: { status: "INVITE_SENT" } });
  if (pending.length === 0) return 0;

  // Marca a checagem antes de chamar: se a chamada falhar, não tenta de novo
  // a cada rodada do cron.
  await prisma.settings.update({ where: { id: "singleton" }, data: { connectionsCheckedAt: new Date() } });

  // Indexa pelo slug do perfil: vem da URL ou, na falta dela, do handle.
  const bySlug = new Map<string, EdgesConnection>();
  for (const connection of await extractConnections(identityId)) {
    const slug =
      (connection.linkedin_profile_url && linkedinProfileSlug(connection.linkedin_profile_url)) ||
      connection.linkedin_profile_handle?.trim().toLowerCase();
    if (slug) bySlug.set(slug, connection);
  }

  let accepted = 0;
  for (const lead of pending) {
    const slug = linkedinProfileSlug(lead.linkedinProfileUrl);
    const connection = slug ? bySlug.get(slug) : undefined;
    if (!connection) continue;
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        status: "WAITING_REPLY",
        // O ID do perfil é o mesmo que vem como remetente no histórico de
        // mensagens: guardando aqui, a primeira resposta já é reconhecida pelo ID.
        linkedinProfileId: lead.linkedinProfileId ?? (connection.linkedin_profile_id != null ? String(connection.linkedin_profile_id) : null),
        firstName: lead.firstName ?? connection.first_name ?? null,
        lastName: lead.lastName ?? connection.last_name ?? null,
        jobTitle: lead.jobTitle ?? connection.job_title ?? null,
      },
    });
    accepted++;
  }
  return accepted;
}

async function sendAgentMessage(lead: Lead, identityId: string, content: string) {
  const result = await sendMessage(identityId, lead.linkedinProfileUrl, content);
  await prisma.message.create({
    data: {
      leadId: lead.id,
      sender: "AGENT",
      content,
      linkedinMessageId: result.linkedin_message_id,
      deliveredAt: new Date(result.delivered_at),
    },
  });
}


function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : "erro desconhecido";
}

// Leads sem campanha ou numa campanha ativa. Campanha pausada/finalizada não
// recebe abertura nem follow-up (respostas a quem escrever continuam normais).
const IN_ACTIVE_CAMPAIGN = { OR: [{ campaignId: null }, { campaign: { status: "ACTIVE" as const } }] };

// Conectado e sem nenhuma mensagem: o agente abre a conversa.
async function sendOpenings(identityId: string, settings: Settings, budget: number): Promise<number> {
  if (budget <= 0) return 0;
  const leads = await prisma.lead.findMany({
    // Sem conversa no LinkedIn (thread) e sem mensagem no banco. Checar a thread
    // evita mandar "obrigado por conectar" no meio de uma conversa que existe
    // mas cuja sincronização falhou.
    where: { status: { in: PROACTIVE_STATUSES }, linkedinThreadId: null, messages: { none: {} }, ...IN_ACTIVE_CAMPAIGN },
    orderBy: { updatedAt: "asc" },
  });
  const rules = parseExclusionList(settings.exclusionList);
  const eligible = leads.filter((l) => !isExcluded({ ...l, headline: l.jobTitle }, rules)).slice(0, budget);

  let sent = 0;
  for (const lead of eligible) {
    try {
      const content = await generateOpeningMessage(await instructionsFor(lead, settings), lead);
      await sendAgentMessage(lead, identityId, content);
      await prisma.lead.update({ where: { id: lead.id }, data: { status: "WAITING_REPLY", followUpsSent: 0 } });
      sent++;
    } catch (err) {
      // Tira o lead do ciclo automático em vez de tentar de novo a cada rodada.
      await markNeedsHuman(lead.id, `Falha ao enviar a mensagem de abertura: ${errorMessage(err)}`);
    }
  }
  return sent;
}

// Última mensagem é nossa e já passou do intervalo: manda follow-up ou, se a
// sequência acabou, marca como sem resposta.
async function sendFollowUps(
  identityId: string,
  settings: Settings,
  budget: number,
): Promise<{ sent: number; lost: number }> {
  const now = Date.now();
  const leads = (
    await prisma.lead.findMany({
      where: { status: { in: PROACTIVE_STATUSES }, ...IN_ACTIVE_CAMPAIGN },
      include: {
        messages: { orderBy: { deliveredAt: "desc" }, take: 1 },
        campaign: { select: { followUpMaxCount: true, followUpDelayHours: true } },
      },
    })
  ).map((l) => ({ ...l, rule: followUpRuleFor(l, l.campaign, settings) }));
  const rules = parseExclusionList(settings.exclusionList);
  // Cada lead segue a própria regra: conversa > campanha > padrão da conta.
  const due = leads
    .filter(
      (l) =>
        l.messages[0] && l.messages[0].sender !== "LEAD" && l.messages[0].deliveredAt.getTime() < now - l.rule.delayHours * 60 * 60 * 1000,
    )
    // Lista de exclusão: nem follow-up nem "perdido" — o corretor conduz.
    .filter((l) => !isExcluded({ ...l, headline: l.jobTitle }, rules))
    .sort((a, b) => a.messages[0].deliveredAt.getTime() - b.messages[0].deliveredAt.getTime());

  let sent = 0;
  let lost = 0;
  for (const lead of due) {
    if (lead.followUpsSent >= lead.rule.maxCount) {
      await prisma.lead.update({ where: { id: lead.id }, data: { status: "LOST" } });
      lost++;
      continue;
    }
    if (sent >= budget) continue;

    try {
      const history = await prisma.message.findMany({
        where: { leadId: lead.id },
        orderBy: { deliveredAt: "asc" },
        select: { sender: true, content: true },
      });
      const attempt = lead.followUpsSent + 1;
      const previous = new Set(history.filter((m) => m.sender !== "LEAD").map((m) => normalizeText(m.content)));

      const instructions = await instructionsFor(lead, settings);
      let content = await generateFollowUp(instructions, lead, history, attempt, lead.rule.maxCount);
      if (previous.has(normalizeText(content))) {
        // Repetiu uma mensagem anterior: uma segunda tentativa; se repetir de novo, não envia.
        content = await generateFollowUp(instructions, lead, history, attempt, lead.rule.maxCount);
        if (previous.has(normalizeText(content))) throw new Error("o agente repetiu uma mensagem anterior");
      }

      await sendAgentMessage(lead, identityId, content);
      await prisma.lead.update({ where: { id: lead.id }, data: { followUpsSent: attempt } });
      sent++;
    } catch (err) {
      await markNeedsHuman(lead.id, `Falha ao enviar follow-up: ${errorMessage(err)}`);
    }
  }
  return { sent, lost };
}

// Lead escreveu fora do horário: a resposta não saiu na hora (ver cron). Aqui,
// já dentro da janela, a IA responde quem está esperando — a última mensagem
// da conversa é do lead e ninguém respondeu ainda.
async function answerPendingReplies(identityId: string): Promise<number> {
  const leads = await prisma.lead.findMany({
    where: { status: { in: ["CONVERSATION_OPEN", "QUALIFIED"] } },
    include: { messages: { orderBy: { deliveredAt: "desc" }, take: 1 } },
  });
  const pending = leads.filter((l) => l.messages[0]?.sender === "LEAD").slice(0, MAX_PROACTIVE_PER_RUN);
  for (const lead of pending) {
    await handleIncomingMessage(lead, identityId);
  }
  return pending.length;
}

export async function runProactive(identityId: string): Promise<ProactiveResult> {
  const result: ProactiveResult = { acceptedInvites: 0, repliesSent: 0, openingsSent: 0, followUpsSent: 0, markedLost: 0 };
  const settings = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } });

  // Mesmas travas do handleIncomingMessage: pausado, nada acontece sozinho.
  if (settings.automationPaused) return { ...result, skipped: "automação pausada" };
  // Fora do horário de trabalho nada sai; o que ficou devido sai na próxima janela.
  if (!isWithinWorkHours(settings)) return { ...result, skipped: "fora do horário de trabalho" };

  result.engagement = await runEngagement(identityId, settings);

  try {
    result.acceptedInvites = await detectAcceptedInvites(identityId, settings);
  } catch (err) {
    console.error("Falha ao checar convites aceitos", err);
  }

  // Respostas que ficaram pra depois (lead escreveu fora do horário) vêm antes
  // de qualquer iniciativa nossa.
  result.repliesSent = await answerPendingReplies(identityId);

  const remainingToday = settings.dailyMessageLimit - (await messagesSentToday());
  let budget = Math.max(0, Math.min(MAX_PROACTIVE_PER_RUN, remainingToday));

  result.openingsSent = await sendOpenings(identityId, settings, budget);
  budget -= result.openingsSent;

  const followUps = await sendFollowUps(identityId, settings, budget);
  result.followUpsSent = followUps.sent;
  result.markedLost = followUps.lost;

  if (remainingToday <= 0) result.skipped = "limite diário de mensagens atingido";
  return result;
}
