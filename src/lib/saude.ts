import { prisma } from "@/lib/prisma";
import { readSyncReport } from "@/lib/syncReport";
import { countedMailboxes, countedUsers, loadPlan } from "@/lib/plan";
import { aiUsageSummary, conversationsThisMonth, MAX_AI_PER_CONVERSATION, NON_COUNTED_PURPOSES, startOfMonthSP } from "@/lib/aiUsage";
import { effectiveLimits, emailsSentToday, messagesSentToday, whatsappSentToday } from "@/lib/limits";
import { effectiveLimit } from "@/lib/mailboxPolicy";
import { sentTodayByMailbox } from "@/lib/mailboxes";
import { remainingDailyInviteQuota } from "@/lib/prospect";
import { deskcommConfigOf, whatsappLiveStatus } from "@/lib/deskcomm";
import { elevenUsage, voiceMessagesLeft } from "@/lib/voice/usage";
import { elevenConfigured } from "@/lib/voice/elevenlabs";

// Retrato do sistema para o dono "bater o olho": o que está rodando, quanto se gastou, o que está perto do limite
// e o que precisa de atenção. Quem lê é a central local (/api/ops/status); nada aqui muda nada.
export type Level = "alto" | "medio" | "info";
export interface Attention {
  level: Level;
  text: string;
  where: string;
}

const MIN = 60 * 1000;
// O robô é chamado de 15 em 15 minutos: 45 sem rodar já é sinal de que o agendador parou.
const ROBOT_STALE_MIN = 45;

function envNumber(name: string): number | null {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function buildStatus(now = new Date()) {
  const settings = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } });
  const limits = effectiveLimits(settings);
  const monthStart = startOfMonthSP(now);
  const since24h = new Date(now.getTime() - 24 * 60 * MIN);

  const [liSent, emSent, waSent, invitesLeft, mailboxes, sentByBox, draftsPending, draftsApproved, draftsFailed, needHuman, aiFailures, conversations, ai, voice, longConversations, activeUsers] = await Promise.all([
    messagesSentToday(),
    emailsSentToday(),
    whatsappSentToday(),
    remainingDailyInviteQuota(),
    prisma.mailbox.findMany({ where: { status: { not: "RETIRED" } }, orderBy: { createdAt: "asc" } }),
    sentTodayByMailbox(now),
    prisma.draft.count({ where: { status: "PENDING" } }),
    prisma.draft.count({ where: { status: "APPROVED" } }),
    prisma.draft.count({ where: { status: "FAILED", decidedAt: { gte: since24h } } }),
    prisma.lead.count({ where: { status: "NEEDS_HUMAN" } }),
    prisma.lead.count({ where: { status: "NEEDS_HUMAN", needsHumanReason: { startsWith: "Falha" } } }),
    conversationsThisMonth(now),
    aiUsageSummary(now),
    elevenUsage(),
    prisma.aiUsage.groupBy({ by: ["leadId"], where: { leadId: { not: null }, createdAt: { gte: monthStart }, purpose: { notIn: NON_COUNTED_PURPOSES } }, _count: { _all: true }, orderBy: { _count: { leadId: "desc" } }, take: 5 }),
    prisma.panelUser.count({ where: { active: true } }),
  ]);

  // Quem está no topo das conversas longas (perto do limite de uso justo).
  const topIds = longConversations.map((r) => r.leadId).filter((id): id is string => Boolean(id));
  const topLeads = topIds.length ? await prisma.lead.findMany({ where: { id: { in: topIds } }, select: { id: true, firstName: true, lastName: true } }) : [];
  const nameOf = (id: string) => {
    const l = topLeads.find((x) => x.id === id);
    return [l?.firstName, l?.lastName].filter(Boolean).join(" ") || "Contato sem nome";
  };
  const longest = longConversations.map((r) => ({ nome: nameOf(r.leadId as string), interacoes: r._count._all }));

  // Caixas de envio: o que cada uma pode mandar hoje (com aquecimento), o que já mandou e se tem problema.
  const boxes = mailboxes.map((mb) => {
    const cap = effectiveLimit(mb, now);
    const sent = sentByBox.get(mb.id) ?? 0;
    const days = Math.max(1, Math.floor((now.getTime() - mb.startedAt.getTime()) / (24 * 60 * MIN)) + 1);
    return {
      endereco: mb.address,
      status: mb.status,
      enviadosHoje: sent,
      limiteHoje: cap,
      tetoDiario: mb.dailyLimit,
      diasDeUso: days,
      aquecendo: cap < mb.dailyLimit,
      rejeitados: mb.bounces,
      bloqueadosPeloDestino: mb.blockedBounces,
      ultimoErro: mb.lastError,
      ultimoErroEm: mb.lastErrorAt,
      ultimaLeitura: mb.lastCheckedAt,
    };
  });
  const activeBoxes = boxes.filter((b) => b.status === "ACTIVE");

  // WhatsApp: só pergunta ao serviço quando está configurado (a chamada pode demorar alguns segundos).
  const wa = deskcommConfigOf(settings);
  const whatsappLive = wa ? await whatsappLiveStatus(wa).catch(() => "unknown" as const) : null;

  const robotMinutes = settings.lastRobotRunAt ? Math.round((now.getTime() - settings.lastRobotRunAt.getTime()) / MIN) : null;
  const costDays = Math.max(1, now.getUTCDate());
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  // O plano vem do banco (a Central LP grava). As variáveis antigas só valem se o plano não definir o número.
  const plan = await loadPlan();
  const [planBoxes, planUsersUsed] = await Promise.all([countedMailboxes(), countedUsers()]);
  const aiBudget = plan.aiBudgetUsd ?? envNumber("AI_BUDGET_USD");
  const planConversations = plan.conversations ?? envNumber("PLAN_CONVERSATIONS_LIMIT");

  const monthCost = ai.costUsd;
  const projection = (monthCost / costDays) * daysInMonth;

  const used = (n: number, max: number) => ({ usado: n, limite: max, percentual: max > 0 ? Math.round((n / max) * 100) : 0 });

  const status = {
    geradoEm: now.toISOString(),
    versao: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    robo: {
      ultimaRodada: settings.lastRobotRunAt?.toISOString() ?? null,
      minutosDesdeUltimaRodada: robotMinutes,
      // Última rodada que chegou ao fim e, por canal, se funcionou (ligado ≠ conseguindo trabalhar).
      ultimaRodadaConcluida: readSyncReport(settings.syncReport)?.finishedAt ?? null,
      sincronizacao: readSyncReport(settings.syncReport)?.channels ?? null,
      automacaoPausada: settings.automationPaused,
      aprovacaoLigada: settings.approvalMode,
      expediente: `${settings.workStartHour}h às ${settings.workEndHour}h`,
    },
    canais: {
      linkedin: { conectado: Boolean(settings.linkedinIdentityId) && !settings.linkedinNeedsReconnect, precisaReconectar: settings.linkedinNeedsReconnect, motivo: settings.linkedinReconnectReason },
      email: { ligado: settings.emailChannelEnabled, caixasAtivas: activeBoxes.length },
      whatsapp: { ligado: settings.whatsappChannelEnabled, configurado: Boolean(wa), estado: whatsappLive },
      google: { conectado: Boolean(settings.googleRefreshToken), conta: settings.googleEmail, agenda: settings.googleCalendarEnabled },
    },
    hoje: {
      linkedinMensagens: used(liSent, limits.linkedinMessages),
      linkedinConvites: used(limits.invites - invitesLeft, limits.invites),
      email: { enviados: emSent, limite: limits.email },
      whatsapp: used(waSent, limits.whatsapp),
    },
    caixas: boxes,
    fila: { aprovacoesPendentes: draftsPending, aprovadasEsperando: draftsApproved, falhasEm24h: draftsFailed, contatosParaVoce: needHuman, falhasDeIA: aiFailures },
    ia: {
      modelo: settings.agentModel ?? null,
      mes: { conversas: conversations, interacoes: ai.interactions, tokensEntrada: ai.inputTokens, tokensSaida: ai.outputTokens, custoUsd: Math.round(monthCost * 10000) / 10000, porTipo: ai.byPurpose },
      custoPorConversaUsd: conversations > 0 ? Math.round((monthCost / conversations) * 10000) / 10000 : null,
      interacoesPorConversa: conversations > 0 ? Math.round((ai.interactions / conversations) * 10) / 10 : null,
      projecaoDoMesUsd: Math.round(projection * 100) / 100,
      limiteDeUsoJusto: MAX_AI_PER_CONVERSATION,
      maioresConversas: longest,
      orcamentoUsd: aiBudget,
      limiteConversasDoPlano: planConversations,
    },
    voz: elevenConfigured()
      ? voice
        ? { servico: "ElevenLabs", plano: voice.plan, usado: voice.used, limite: voice.limit, percentual: voice.percent, mensagensRestantes: voiceMessagesLeft(voice), renovaEm: voice.resetAt?.toISOString() ?? null }
        : { servico: "ElevenLabs", indisponivel: true }
      : null,
    pessoas: { acessosAtivos: activeUsers },
    plano: {
      nome: plan.name,
      conversas: planConversations ? used(conversations, planConversations) : null,
      caixas: plan.mailboxes !== null ? used(planBoxes, plan.mailboxes) : null,
      acessos: plan.users !== null ? used(planUsersUsed, plan.users) : null,
      orcamentoIaUsd: aiBudget ? { usado: Math.round(monthCost * 100) / 100, limite: aiBudget, percentual: Math.round((monthCost / aiBudget) * 100) } : null,
    },
  };

  // O que precisa de atenção, do mais grave para o menos grave.
  const att: Attention[] = [];
  const add = (level: Level, text: string, where: string) => att.push({ level, text, where });

  if (robotMinutes === null) add("medio", "O robô ainda não registrou nenhuma rodada.", "Robô");
  else if (robotMinutes > ROBOT_STALE_MIN) add("alto", `O robô não roda há ${robotMinutes} minutos. Confira o agendador (cron-job.org).`, "Robô");
  if (settings.automationPaused) add("info", "A automação está pausada: nada sai sozinho.", "Robô");
  if (settings.linkedinNeedsReconnect) add("alto", `LinkedIn desconectado${settings.linkedinReconnectReason ? `: ${settings.linkedinReconnectReason}` : ""}.`, "Canais");
  if (wa && whatsappLive === "down") add("alto", "O número de WhatsApp caiu. É preciso reconectar pelo QR.", "Canais");
  if (settings.emailChannelEnabled && activeBoxes.length === 0) add("alto", "O canal de e-mail está ligado, mas não há nenhuma caixa ativa.", "Caixas");
  for (const b of boxes) {
    if (b.status === "PAUSED") add("medio", `Caixa ${b.endereco} está pausada.`, "Caixas");
    if (b.status === "ACTIVE" && b.ultimoErro && b.ultimoErroEm && now.getTime() - b.ultimoErroEm.getTime() < 24 * 60 * MIN) add("alto", `Caixa ${b.endereco} com erro: ${b.ultimoErro}`, "Caixas");
    if (b.status === "ACTIVE" && b.rejeitados >= 3) add("medio", `Caixa ${b.endereco} já teve ${b.rejeitados} e-mails devolvidos (endereços que não existem ou bloqueios): vale conferir a lista.`, "Caixas");
    if (b.status === "ACTIVE" && b.limiteHoje > 0 && b.enviadosHoje >= b.limiteHoje) add("info", `Caixa ${b.endereco} chegou ao limite de hoje (${b.limiteHoje}).`, "Caixas");
  }
  if (liSent >= limits.linkedinMessages) add("medio", "O limite de mensagens do LinkedIn de hoje acabou.", "Limites");
  if (limits.invites - invitesLeft >= limits.invites) add("info", "O limite de convites do LinkedIn de hoje acabou.", "Limites");
  if (draftsPending >= 20) add("alto", `${draftsPending} mensagens esperando aprovação: acima de 20 a assistente para de gerar novas.`, "Fila");
  else if (draftsPending >= 10) add("medio", `${draftsPending} mensagens esperando aprovação.`, "Fila");
  if (draftsFailed > 0) add("alto", `${draftsFailed} mensagem(ns) aprovada(s) falharam ao enviar nas últimas 24 horas.`, "Fila");
  if (aiFailures > 0) add("alto", `${aiFailures} contato(s) parados por falha da IA (chave, crédito ou limite do provedor).`, "IA");
  if (aiBudget && monthCost >= aiBudget) add("alto", `O gasto de IA do mês (US$ ${monthCost.toFixed(2)}) chegou ao orçamento de US$ ${aiBudget}.`, "IA");
  else if (aiBudget && projection >= aiBudget) add("medio", `No ritmo atual, o gasto de IA do mês chega a US$ ${projection.toFixed(2)}, acima do orçamento de US$ ${aiBudget}.`, "IA");
  if (plan.mailboxes !== null && planBoxes > plan.mailboxes) add("medio", `Há ${planBoxes} caixas cadastradas e o plano inclui ${plan.mailboxes}.`, "Plano");
  if (plan.users !== null && planUsersUsed > plan.users) add("medio", `Há ${planUsersUsed} acessos ativos e o plano inclui ${plan.users}.`, "Plano");
  if (!plan.name) add("info", "Nenhum plano definido para este cliente: os limites do plano não valem. Defina na Central LP.", "Plano");
  if (planConversations && conversations >= planConversations) add("alto", `As conversas do mês chegaram ao limite do plano (${planConversations}).`, "Plano");
  else if (planConversations && conversations >= planConversations * 0.8) add("medio", `${conversations} de ${planConversations} conversas do plano usadas no mês.`, "Plano");
  if (longest.length && longest[0].interacoes >= MAX_AI_PER_CONVERSATION - 5) add("info", `${longest[0].nome} está com ${longest[0].interacoes} interações de IA no mês (limite de uso justo: ${MAX_AI_PER_CONVERSATION}).`, "IA");
  if (voice && voice.percent >= 100) add("alto", "Os créditos de voz do mês acabaram: as respostas saem em texto até renovar.", "Voz");
  else if (voice && voice.percent >= 80) add("medio", `Créditos de voz em ${voice.percent}%: restam cerca de ${voiceMessagesLeft(voice)} mensagens de voz.`, "Voz");
  if (elevenConfigured() && !voice) add("info", "Não consegui consultar os créditos de voz agora.", "Voz");
  if (!settings.googleRefreshToken) add("info", "Google não está conectado: sem agenda nem avisos por e-mail.", "Canais");

  const order: Record<Level, number> = { alto: 0, medio: 1, info: 2 };
  att.sort((a, b) => order[a.level] - order[b.level]);
  const overall: "ok" | "atencao" | "problema" = att.some((a) => a.level === "alto") ? "problema" : att.some((a) => a.level === "medio") ? "atencao" : "ok";

  return { geral: overall, atencao: att, ...status };
}
