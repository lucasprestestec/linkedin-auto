import type { Lead, MessageChannel, Settings } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { markNeedsHuman } from "@/lib/handoff";
import { extractConnections, type EdgesConnection } from "@/lib/edges";
import { decideNextStep, generateBookingNudge, generateFirstContact, generateFollowUp, generateIntroEmail, generateOpeningMessage } from "@/lib/agent";
import { emailsSentToday, messagesSentToday, whatsappSentToday } from "@/lib/limits";
import { deskcommConfigOf } from "@/lib/deskcomm";
import { emailEnabled } from "@/lib/email";
import { isWithinWorkHours } from "@/lib/schedule";
import { isExcluded, parseExclusionList } from "@/lib/exclusion";
import { handleIncomingMessage } from "@/lib/respond";
import { runEngagement, type EngagementResult } from "@/lib/engagement";
import { instructionsFor } from "@/lib/campaigns";
import { linkedinProfileSlug } from "@/lib/linkedin";
import { PROACTIVE_STATUSES } from "@/lib/status";
import { followUpRuleFor } from "@/lib/followupPolicy";
import { CHANNEL_LABEL } from "@/lib/channels";
import { MAX_PENDING_DRAFTS, OPEN_DRAFT_FILTER, deliver, expireDrafts, flushApprovedDrafts, pendingDraftCount } from "@/lib/outbox";

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
  introEmailsSent: number;
  firstContactsSent: number;
  followUpsSent: number;
  waiting: number;
  markedLost: number;
  bookingNudgesSent: number;
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

  // Convite pendente = ainda não conectado (pode estar conversando por e-mail).
  const pending = await prisma.lead.findMany({ where: { linkedinConnected: false, linkedinProfileUrl: { not: null }, status: { not: "LOST" } } });
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
        linkedinConnected: true,
        connectedAt: new Date(),
        // Quem já conversa por e-mail continua no status que está.
        status: lead.status === "INVITE_SENT" ? "WAITING_REPLY" : lead.status,
        // O ID do perfil é o mesmo que vem como remetente no histórico de
        // mensagens: guardando aqui, a primeira resposta já é reconhecida pelo ID.
        linkedinProfileId: lead.linkedinProfileId ?? (connection.linkedin_profile_id != null ? String(connection.linkedin_profile_id) : null),
        firstName: lead.firstName ?? connection.first_name ?? null,
        lastName: lead.lastName ?? connection.last_name ?? null,
        jobTitle: lead.jobTitle ?? connection.job_title ?? null,
        // Foto real do perfil (só https); se não carregar, a tela mostra o bonequinho.
        avatarUrl: lead.avatarUrl ?? (connection.profile_image_url?.startsWith("https://") ? connection.profile_image_url : null),
      },
    });
    accepted++;
  }
  return accepted;
}

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : "erro desconhecido";
}

// Leads sem campanha ou numa campanha ativa. Campanha pausada/finalizada não
// recebe abertura nem follow-up (respostas a quem escrever continuam normais).
const IN_ACTIVE_CAMPAIGN = { OR: [{ campaignId: null }, { campaign: { status: "ACTIVE" as const } }] };

const DAY_MS = 24 * 60 * 60 * 1000;
// Quando a secretária decide esperar, ela volta a olhar esse lead depois disso.
const WAIT_MS = DAY_MS;

// Quantos envios ainda cabem nesta rodada, por canal. Cada canal tem o próprio
// limite diário; o total por rodada espalha os envios ao longo do dia.
interface Budget {
  total: number;
  LINKEDIN: number;
  EMAIL: number;
  WHATSAPP: number;
}

function spend(budget: Budget, channel: MessageChannel) {
  budget.total--;
  budget[channel]--;
}

// WhatsApp só com quem já deu sinal de interesse: respondeu em algum canal,
// abriu um e-mail nosso ou já conversa por lá. Mensagem fria no WhatsApp
// incomoda e arrisca bloquear o número.
function showedInterest(lead: Lead, history: HistoryRow[]): boolean {
  return Boolean(lead.whatsappConversationId) || history.some((m) => m.sender === "LEAD" || (m.sender !== "LEAD" && m.openCount > 0));
}

const HISTORY_SELECT = { sender: true, content: true, deliveredAt: true, channel: true, openToken: true, openCount: true, lastOpenedAt: true } as const;

// Conectado no LinkedIn e ainda sem mensagem por lá: o agente abre a conversa.
// Se já houve e-mail (convite estava parado), a abertura leva isso em conta.
async function sendOpenings(identityId: string, settings: Settings, budget: Budget): Promise<number> {
  if (budget.total <= 0 || budget.LINKEDIN <= 0) return 0;
  const leads = await prisma.lead.findMany({
    // Sem conversa no LinkedIn (thread) e sem mensagem de LinkedIn no banco.
    // Checar a thread evita mandar "obrigado por conectar" no meio de uma
    // conversa que existe mas cuja sincronização falhou.
    where: {
      status: { in: PROACTIVE_STATUSES },
      linkedinConnected: true,
      linkedinThreadId: null,
      messages: { none: { channel: "LINKEDIN" } },
      ...IN_ACTIVE_CAMPAIGN,
      ...OPEN_DRAFT_FILTER,
    },
    orderBy: { updatedAt: "asc" },
    include: { messages: { orderBy: { deliveredAt: "asc" }, select: HISTORY_SELECT } },
  });
  const rules = parseExclusionList(settings.exclusionList);
  // Quem já respondeu por e-mail está numa conversa: não recebe "abertura".
  const eligible = leads
    .filter((l) => !isExcluded({ ...l, headline: l.jobTitle }, rules))
    .filter((l) => l.messages.at(-1)?.sender !== "LEAD")
    .slice(0, Math.min(budget.total, budget.LINKEDIN));

  let sent = 0;
  for (const lead of eligible) {
    try {
      const content = await generateOpeningMessage(await instructionsFor(lead, settings), lead, { history: lead.messages });
      await deliver(lead, "LINKEDIN", content, {
        identityId,
        kind: "OPENING",
        reason: "Aceitou o convite; abertura da conversa no LinkedIn.",
        approval: settings.approvalMode,
        effects: {
          // Já conversando por e-mail: continua "conversando".
          status: lead.status === "CONVERSATION_OPEN" ? "CONVERSATION_OPEN" : "WAITING_REPLY",
          followUpsSent: 0,
          nextStep: "Aceitou o convite; abri a conversa no LinkedIn.",
          nextStepAt: null,
        },
      });
      spend(budget, "LINKEDIN");
      sent++;
    } catch (err) {
      // Tira o lead do ciclo automático em vez de tentar de novo a cada rodada.
      await markNeedsHuman(lead.id, `Falha ao enviar a mensagem de abertura: ${errorMessage(err)}`);
    }
  }
  return sent;
}

// Convite parado há X dias e a pessoa tem e-mail na ficha: a secretária se
// apresenta por e-mail. O convite continua valendo; se for aceito, a conversa
// segue no LinkedIn sabendo do e-mail.
async function sendIntroEmails(settings: Settings, emailReady: boolean, budget: Budget): Promise<number> {
  const days = settings.emailInviteFallbackDays;
  if (!emailReady || days == null || budget.total <= 0 || budget.EMAIL <= 0) return 0;
  const cutoff = new Date(Date.now() - days * DAY_MS);
  const leads = await prisma.lead.findMany({
    where: {
      status: "INVITE_SENT",
      email: { not: null },
      messages: { none: {} },
      OR: [{ invitedAt: { lte: cutoff } }, { invitedAt: null, createdAt: { lte: cutoff } }],
      AND: [IN_ACTIVE_CAMPAIGN, OPEN_DRAFT_FILTER],
    },
    orderBy: { createdAt: "asc" },
  });
  const rules = parseExclusionList(settings.exclusionList);
  const eligible = leads.filter((l) => !isExcluded({ ...l, headline: l.jobTitle }, rules)).slice(0, Math.min(budget.total, budget.EMAIL));

  let sent = 0;
  for (const lead of eligible) {
    const pending = Math.max(days, Math.round((Date.now() - (lead.invitedAt ?? lead.createdAt).getTime()) / DAY_MS));
    try {
      const content = await generateIntroEmail(await instructionsFor(lead, settings), lead, pending);
      await deliver(lead, "EMAIL", content, {
        subject: "Conexão no LinkedIn",
        kind: "INTRO_EMAIL",
        reason: `Convite parado há ${pending} dias; apresentação por e-mail.`,
        approval: settings.approvalMode,
        effects: { followUpsSent: 0, nextStep: `Convite parado há ${pending} dias; me apresentei por e-mail.`, nextStepAt: null },
      });
      spend(budget, "EMAIL");
      sent++;
    } catch (err) {
      await markNeedsHuman(lead.id, `Falha ao enviar o e-mail de apresentação: ${errorMessage(err)}`);
    }
  }
  return sent;
}

// Contato adicionado à mão com "a secretária faz o primeiro contato": ela se
// apresenta no canal escolhido (e-mail ou WhatsApp), dentro do horário e dos
// limites de cada canal. Depois disso segue o fluxo normal de retomadas.
async function sendFirstContacts(settings: Settings, ready: { EMAIL: boolean; WHATSAPP: boolean }, budget: Budget): Promise<number> {
  if (budget.total <= 0) return 0;
  const leads = await prisma.lead.findMany({
    where: { status: "NEW", firstContactChannel: { in: ["EMAIL", "WHATSAPP"] }, messages: { none: {} }, ...IN_ACTIVE_CAMPAIGN, ...OPEN_DRAFT_FILTER },
    orderBy: { createdAt: "asc" },
  });
  const rules = parseExclusionList(settings.exclusionList);
  let sent = 0;
  for (const lead of leads) {
    const channel = lead.firstContactChannel as "EMAIL" | "WHATSAPP";
    if (budget.total <= 0) break;
    if (!ready[channel] || budget[channel] <= 0) continue;
    if (isExcluded({ ...lead, headline: lead.jobTitle }, rules)) continue;
    try {
      const content = await generateFirstContact(await instructionsFor(lead, settings), lead, channel);
      await deliver(lead, channel, content, {
        subject: channel === "EMAIL" ? `Tudo bem, ${lead.firstName ?? ""}?`.replace(" ?", "?") : undefined,
        kind: "FIRST_CONTACT",
        reason: `Primeiro contato por ${channel === "EMAIL" ? "e-mail" : "WhatsApp"} (você pediu).`,
        approval: settings.approvalMode,
        effects: {
          status: "WAITING_REPLY",
          firstContactChannel: null,
          followUpsSent: 0,
          nextStep: `Fiz o primeiro contato por ${channel === "EMAIL" ? "e-mail" : "WhatsApp"}.`,
          nextStepAt: null,
        },
      });
      spend(budget, channel);
      sent++;
    } catch (err) {
      await markNeedsHuman(lead.id, `Falha no primeiro contato por ${channel === "EMAIL" ? "e-mail" : "WhatsApp"}: ${errorMessage(err)}`);
    }
  }
  return sent;
}

type HistoryRow = { sender: string; content: string; deliveredAt: Date; channel: MessageChannel; openToken: string | null; openCount: number; lastOpenedAt: Date | null };

function daysAgo(date: Date, now: number) {
  const d = Math.floor((now - date.getTime()) / DAY_MS);
  return d <= 0 ? "hoje" : d === 1 ? "há 1 dia" : `há ${d} dias`;
}

// Sinais em texto pro agente decidir o próximo passo.
function signalsFor(lead: Lead, history: HistoryRow[], rule: { maxCount: number }, now: number): string[] {
  const out: string[] = [];
  out.push(
    !lead.linkedinConnected
      ? `Convite do LinkedIn ainda pendente (enviado ${daysAgo(lead.invitedAt ?? lead.createdAt, now)}): por lá não dá pra mandar mensagem.`
      : "Vocês estão conectados no LinkedIn.",
  );
  out.push(history.some((m) => m.sender === "LEAD") ? "A pessoa já respondeu antes nesta conversa." : "A pessoa nunca respondeu.");
  for (const channel of ["LINKEDIN", "EMAIL", "WHATSAPP"] as const) {
    const ours = history.filter((m) => m.sender !== "LEAD" && m.channel === channel);
    if (!ours.length) continue;
    const last = ours.at(-1)!;
    let line = `${CHANNEL_LABEL[channel]}: ${ours.length} mensagem(ns) nossa(s), a última ${daysAgo(last.deliveredAt, now)}.`;
    if (channel === "EMAIL") {
      const tracked = ours.filter((m) => m.openToken);
      const opens = tracked.reduce((n, m) => n + m.openCount, 0);
      const lastOpen = tracked.map((m) => m.lastOpenedAt).filter((d): d is Date => Boolean(d)).sort((a, b) => b.getTime() - a.getTime())[0];
      if (tracked.length) line += opens ? ` Aberturas: ${opens} (última ${daysAgo(lastOpen, now)}).` : " Nenhuma abertura registrada.";
    }
    out.push(line);
  }
  if (lead.phone && !history.some((m) => m.channel === "WHATSAPP")) out.push("Tem WhatsApp na ficha, mas ainda não conversaram por lá.");
  out.push(`Retomadas já feitas desde a última resposta: ${lead.followUpsSent} de ${rule.maxCount}.`);
  return out;
}

// Última mensagem é nossa e já passou do intervalo: a secretária decide o
// próximo passo (canal, esperar ou encerrar). Com um canal só, segue direto.
async function sendFollowUps(
  identityId: string | null,
  settings: Settings,
  emailReady: boolean,
  whatsappReady: boolean,
  budget: Budget,
): Promise<{ sent: number; lost: number; waiting: number }> {
  const now = Date.now();
  const leads = (
    await prisma.lead.findMany({
      where: {
        // INVITE_SENT entra só se já recebeu e-mail (apresentação): segue por lá.
        OR: [{ status: { in: PROACTIVE_STATUSES } }, { status: "INVITE_SENT", messages: { some: {} } }],
        AND: [IN_ACTIVE_CAMPAIGN, OPEN_DRAFT_FILTER, { OR: [{ nextStepAt: null }, { nextStepAt: { lte: new Date(now) } }] }],
      },
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
  let waiting = 0;
  for (const lead of due) {
    const history = await prisma.message.findMany({ where: { leadId: lead.id }, orderBy: { deliveredAt: "asc" }, select: HISTORY_SELECT });
    const lastOurs = history.filter((m) => m.sender !== "LEAD").at(-1);
    // Abriu um e-mail depois do nosso último contato: sinal pra uma tentativa a mais.
    const openedSinceLastTouch = history.some((m) => m.sender !== "LEAD" && m.lastOpenedAt && lastOurs && m.lastOpenedAt >= lastOurs.deliveredAt);
    const ended = lead.followUpsSent >= lead.rule.maxCount;
    const extraTouch = ended && openedSinceLastTouch && lead.followUpsSent < lead.rule.maxCount + 1;

    if (ended && !extraTouch) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { status: "LOST", nextStep: `Sem resposta depois de ${lead.followUpsSent} retomada(s); encerrei.`, nextStepAt: null },
      });
      lost++;
      continue;
    }
    if (budget.total <= 0) continue;

    const options: MessageChannel[] = [];
    if (identityId && lead.linkedinConnected && budget.LINKEDIN > 0) options.push("LINKEDIN");
    if (emailReady && lead.email && budget.EMAIL > 0) options.push("EMAIL");
    if (whatsappReady && lead.phone && budget.WHATSAPP > 0 && showedInterest(lead, history)) options.push("WHATSAPP");
    // Nenhum canal disponível agora (limite do dia, LinkedIn desconectado...): tenta na próxima rodada.
    if (options.length === 0) continue;

    try {
      const instructions = await instructionsFor(lead, settings);
      let channel: MessageChannel;
      let reason: string;
      if (options.length === 1 && !extraTouch) {
        channel = options[0];
        reason = `Sem resposta; retomei pelo ${channel === "LINKEDIN" ? "LinkedIn" : channel === "EMAIL" ? "e-mail" : "WhatsApp"} (${lead.followUpsSent + 1} de ${lead.rule.maxCount}).`;
      } else {
        const decision = await decideNextStep({
          instructions,
          lead,
          history,
          options,
          signals: signalsFor(lead, history, lead.rule, now),
          extraTouch,
        });
        console.log(`[próximo passo] lead=${lead.id} opções=${options.join(",")} ação=${decision.action} canal=${decision.channel ?? "-"} motivo=${JSON.stringify(decision.reason)}`);
        if (decision.action === "stop") {
          await prisma.lead.update({ where: { id: lead.id }, data: { status: "LOST", nextStep: decision.reason, nextStepAt: null } });
          lost++;
          continue;
        }
        if (decision.action === "wait") {
          await prisma.lead.update({ where: { id: lead.id }, data: { nextStep: decision.reason, nextStepAt: new Date(now + WAIT_MS) } });
          waiting++;
          continue;
        }
        channel = decision.channel!;
        reason = decision.reason;
      }

      const attempt = lead.followUpsSent + 1;
      const previous = new Set(history.filter((m) => m.sender !== "LEAD").map((m) => normalizeText(m.content)));
      // Na tentativa extra, o texto é o da última da sequência (leve, sem insistir).
      const maxForText = Math.max(lead.rule.maxCount, attempt);
      let content = await generateFollowUp(instructions, lead, history, attempt, maxForText, channel);
      if (previous.has(normalizeText(content))) {
        // Repetiu uma mensagem anterior: uma segunda tentativa; se repetir de novo, não envia.
        content = await generateFollowUp(instructions, lead, history, attempt, maxForText, channel);
        if (previous.has(normalizeText(content))) throw new Error("o agente repetiu uma mensagem anterior");
      }

      await deliver(lead, channel, content, {
        identityId,
        kind: "FOLLOW_UP",
        reason,
        approval: settings.approvalMode,
        effects: { followUpsSent: attempt, nextStep: reason, nextStepAt: null },
      });
      spend(budget, channel);
      sent++;
    } catch (err) {
      await markNeedsHuman(lead.id, `Falha ao enviar follow-up: ${errorMessage(err)}`);
    }
  }
  return { sent, lost, waiting };
}

// Lead escreveu fora do horário: a resposta não saiu na hora (ver cron). Aqui,
// já dentro da janela, a IA responde quem está esperando — a última mensagem
// da conversa é do lead e ninguém respondeu ainda.
async function answerPendingReplies(identityId: string | null): Promise<number> {
  const leads = await prisma.lead.findMany({
    where: { status: { in: ["CONVERSATION_OPEN", "QUALIFIED"] }, ...OPEN_DRAFT_FILTER },
    include: { messages: { orderBy: { deliveredAt: "desc" }, take: 1 } },
  });
  const pending = leads
    .filter((l) => l.messages[0]?.sender === "LEAD")
    // Sem LinkedIn conectado, só dá pra responder quem escreveu por e-mail.
    .filter((l) => identityId || l.messages[0].channel !== "LINKEDIN")
    .slice(0, MAX_PROACTIVE_PER_RUN);
  for (const lead of pending) {
    await handleIncomingMessage(lead, identityId);
  }
  return pending.length;
}

// A secretária pode usar o e-mail por conta própria: caixa conectada e canal ligado.
// WhatsApp: Deskcomm conectado e canal ligado.
export function whatsappChannelReady(settings: Settings): boolean {
  return settings.whatsappChannelEnabled && deskcommConfigOf(settings) !== null;
}

export async function emailChannelReady(settings: Settings): Promise<boolean> {
  return settings.emailChannelEnabled && (await emailEnabled());
}

// Sugeriu horários de reunião e o lead não escolheu em 2 dias: uma pergunta leve, uma vez
// só. Sai pelo canal da última mensagem (onde os horários foram oferecidos). Depois disso a
// conversa fica com o corretor, que vê "Qualificado" na lista.
const BOOKING_NUDGE_DELAY_MS = 2 * DAY_MS;

async function sendBookingNudges(
  identityId: string | null,
  settings: Settings,
  ready: { LINKEDIN: boolean; EMAIL: boolean; WHATSAPP: boolean },
  budget: Budget,
): Promise<number> {
  if (budget.total <= 0) return 0;
  const leads = await prisma.lead.findMany({
    where: {
      status: "QUALIFIED",
      meetingAt: null,
      bookingNudgedAt: null,
      slotsProposedAt: { lt: new Date(Date.now() - BOOKING_NUDGE_DELAY_MS) },
      AND: [IN_ACTIVE_CAMPAIGN, OPEN_DRAFT_FILTER],
    },
    orderBy: { slotsProposedAt: "asc" },
  });
  const rules = parseExclusionList(settings.exclusionList);
  let sent = 0;
  for (const lead of leads) {
    if (budget.total <= 0) break;
    if (isExcluded({ ...lead, headline: lead.jobTitle }, rules)) continue;
    const history = await prisma.message.findMany({ where: { leadId: lead.id }, orderBy: { deliveredAt: "asc" }, select: HISTORY_SELECT });
    const last = history.at(-1);
    // O lead respondeu depois dos horários: a conversa andou, não cabe lembrete.
    if (!last || last.sender === "LEAD") continue;
    const channel = last.channel;
    if (!ready[channel] || budget[channel] <= 0) continue;
    try {
      const content = await generateBookingNudge(await instructionsFor(lead, settings), lead, history, channel);
      await deliver(lead, channel, content, {
        identityId,
        kind: "FOLLOW_UP",
        reason: "Sugeri horários há 2 dias e ele não respondeu; pergunta leve, uma vez só.",
        approval: settings.approvalMode,
        effects: { bookingNudgedAt: new Date(), nextStep: "Perguntei se algum dos horários serviu." },
      });
      spend(budget, channel);
      sent++;
    } catch (err) {
      await markNeedsHuman(lead.id, `Falha ao lembrar da agenda: ${errorMessage(err)}`);
    }
  }
  return sent;
}

export async function runProactive(identityId: string | null): Promise<ProactiveResult> {
  const result: ProactiveResult = { acceptedInvites: 0, repliesSent: 0, openingsSent: 0, introEmailsSent: 0, firstContactsSent: 0, followUpsSent: 0, waiting: 0, markedLost: 0, bookingNudgesSent: 0 };
  const settings = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } });

  // Rascunho que ninguém decidiu a tempo perde a validade (a conversa andou).
  await expireDrafts().catch((err) => console.error("Falha ao expirar rascunhos", err));

  // Mesmas travas do handleIncomingMessage: pausado, nada acontece sozinho.
  if (settings.automationPaused) return { ...result, skipped: "automação pausada" };
  // O assistente se apresenta pelo nome cadastrado: sem ele, não abre conversa nem faz follow-up.
  if (!settings.ownerName?.trim()) return { ...result, skipped: "falta cadastrar o nome do corretor" };
  // Fora do horário de trabalho nada sai; o que ficou devido sai na próxima janela.
  if (!isWithinWorkHours(settings)) return { ...result, skipped: "fora do horário de trabalho" };

  if (identityId) {
    result.engagement = await runEngagement(identityId, settings);
    try {
      result.acceptedInvites = await detectAcceptedInvites(identityId, settings);
    } catch (err) {
      console.error("Falha ao checar convites aceitos", err);
    }
  }

  // Respostas que ficaram pra depois (lead escreveu fora do horário) vêm antes
  // de qualquer iniciativa nossa.
  result.repliesSent = await answerPendingReplies(identityId);

  // Aprovado fora do horário sai agora que a janela abriu.
  await flushApprovedDrafts().catch((err) => console.error("Falha ao enviar mensagens aprovadas", err));

  // Muita coisa esperando o seu OK: a secretária não gera mais nada até você limpar a fila.
  if ((await pendingDraftCount()) >= MAX_PENDING_DRAFTS) return { ...result, skipped: "aprovações pendentes demais: abra Aprovações" };

  const emailReady = await emailChannelReady(settings);
  const linkedinLeft = identityId ? settings.dailyMessageLimit - (await messagesSentToday()) : 0;
  const emailLeft = emailReady ? settings.dailyEmailLimit - (await emailsSentToday()) : 0;
  const whatsappReady = whatsappChannelReady(settings);
  const whatsappLeft = whatsappReady ? settings.dailyWhatsappLimit - (await whatsappSentToday()) : 0;
  const budget: Budget = {
    total: MAX_PROACTIVE_PER_RUN,
    LINKEDIN: Math.max(0, linkedinLeft),
    EMAIL: Math.max(0, emailLeft),
    WHATSAPP: Math.max(0, whatsappLeft),
  };

  if (identityId) result.openingsSent = await sendOpenings(identityId, settings, budget);
  result.introEmailsSent = await sendIntroEmails(settings, emailReady, budget);
  // Pedido explícito do corretor: vale com o canal conectado, mesmo que a
  // secretária não use aquele canal por conta própria.
  const firstBudget: Budget = {
    ...budget,
    EMAIL: emailReady ? budget.EMAIL : Math.max(0, settings.dailyEmailLimit - (await emailsSentToday())),
    WHATSAPP: whatsappReady ? budget.WHATSAPP : Math.max(0, settings.dailyWhatsappLimit - (await whatsappSentToday())),
  };
  result.firstContactsSent = await sendFirstContacts(
    settings,
    { EMAIL: await emailEnabled(), WHATSAPP: deskcommConfigOf(settings) !== null },
    firstBudget,
  );
  // O que saiu no primeiro contato conta pro resto da rodada.
  budget.total = firstBudget.total;
  if (emailReady) budget.EMAIL = firstBudget.EMAIL;
  if (whatsappReady) budget.WHATSAPP = firstBudget.WHATSAPP;

  const followUps = await sendFollowUps(identityId, settings, emailReady, whatsappReady, budget);
  result.followUpsSent = followUps.sent;
  result.waiting = followUps.waiting;
  result.markedLost = followUps.lost;

  result.bookingNudgesSent = await sendBookingNudges(identityId, settings, { LINKEDIN: Boolean(identityId), EMAIL: emailReady, WHATSAPP: whatsappReady }, budget);

  if (identityId && linkedinLeft <= 0) result.skipped = "limite diário de mensagens do LinkedIn atingido";
  return result;
}
