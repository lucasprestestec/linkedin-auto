"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { activeIdentityIdOrNull } from "@/lib/identity";
import { sendOnChannel } from "@/lib/channels";
import { supersedeDrafts } from "@/lib/outbox";
import { TAKEOVER_REASON } from "@/lib/handoff";
import type { MessageChannel } from "@prisma/client";
import { prepareMeeting, summarizeConversation, suggestReply } from "@/lib/agent";
import { instructionsFor } from "@/lib/campaigns";
import { validFollowUp } from "@/lib/settings-ranges";
import { parseLeadKind } from "@/lib/leadKind";
import { parseEmail, parsePhone } from "@/lib/contactFields";
import { recordFeedback } from "@/lib/agentFeedback";
import { requireSession } from "@/lib/session";
import { sendNoShow } from "@/lib/meetingReminders";
import { parseDealStage, parseMoneyCents } from "@/lib/deal";
import { checkEmailDomain, domainOf, noMailMessage } from "@/lib/emailDomain";
import { appendNote, appendPersonal, dueDate, sanitizeProposal, todaySP, validDue } from "@/lib/leadUpdate";
import type { Prisma } from "@prisma/client";
import { addYear, formatISO, parseRenewalDate, renewalDate, renewalISO, todayISO } from "@/lib/renewal";
import { isReplyIntent, REMIND_OPTIONS, REPLY_INTENTS } from "@/lib/replyIntents";

export async function sendReply(leadId: string, _prevState: { error?: string } | undefined, formData: FormData) {
  await requireSession();
  const content = String(formData.get("content") ?? "").trim();
  if (!content) return { error: "Escreva uma mensagem." };

  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });

  // Canal escolhido no composer; se não vier (ou não for válido), LinkedIn.
  const raw = formData.get("channel");
  const channel: MessageChannel = raw === "EMAIL" || raw === "WHATSAPP" ? raw : "LINKEDIN";

  try {
    const identityId = channel === "LINKEDIN" ? await activeIdentityIdOrNull() : null;
    await sendOnChannel(lead, channel, content, { identityId, sender: "HUMAN" });
    // "Conversando" só se o lead já respondeu alguma vez; senão, seguimos
    // aguardando a primeira resposta dele.
    const leadHasReplied = await prisma.message.count({ where: { leadId: lead.id, sender: "LEAD" } });
    await supersedeDrafts(lead.id, "Você respondeu direto antes de a mensagem sair.");
    // Conversa assumida continua sua até você devolver ao assistente.
    if (!(lead.status === "NEEDS_HUMAN" && lead.needsHumanReason === TAKEOVER_REASON)) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { status: leadHasReplied > 0 ? "CONVERSATION_OPEN" : "WAITING_REPLY", needsHumanReason: null },
      });
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Falha ao enviar mensagem." };
  }

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/");
  return { error: undefined };
}

// ---------------------------------------------------------------------------
// CRM: anotações e etiquetas do corretor sobre o lead.
// ---------------------------------------------------------------------------

export async function updateLeadNotes(leadId: string, notes: string) {
  await requireSession();
  await prisma.lead.update({ where: { id: leadId }, data: { notes: notes.trim() || null } });
  revalidatePath(`/leads/${leadId}`);
  return { saved: true };
}

// Etiquetas: minúsculas, sem espaço sobrando, sem repetir, até 10 por lead.
export async function updateLeadTags(leadId: string, tags: string[]) {
  await requireSession();
  const clean = [...new Set(tags.map((t) => t.trim().toLowerCase().slice(0, 30)).filter(Boolean))].slice(0, 10);
  await prisma.lead.update({ where: { id: leadId }, data: { tags: clean } });
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/");
  return { tags: clean };
}

export async function updateLeadCampaign(leadId: string, campaignId: string | null) {
  await requireSession();
  await prisma.lead.update({ where: { id: leadId }, data: { campaignId } });
  revalidatePath(`/leads/${leadId}`);
  return { saved: true };
}

// Responsável pelo contato (quem da equipe atende). Vazio = ninguém em particular.
export async function updateLeadAssignee(leadId: string, assigneeId: string | null) {
  await requireSession();
  const member = assigneeId ? await prisma.teamMember.findUnique({ where: { id: assigneeId }, select: { id: true } }) : null;
  await prisma.lead.update({ where: { id: leadId }, data: { assigneeId: member?.id ?? null } });
  revalidatePath(`/leads/${leadId}`);
  return { saved: true };
}

// ---------------------------------------------------------------------------
// Ações do corretor sobre o lead (menu "Mais ações" e card de handoff).
// ---------------------------------------------------------------------------

export type LeadActionKind = "qualify" | "takeover" | "handback" | "lost";

export async function leadAction(leadId: string, kind: LeadActionKind) {
  await requireSession();
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
  if (kind === "qualify") {
    await prisma.lead.update({ where: { id: leadId }, data: { status: "QUALIFIED", needsHumanReason: null } });
  } else if (kind === "takeover") {
    // Assumir = a IA para de responder esta conversa até você devolver.
    await supersedeDrafts(leadId, "Você assumiu a conversa antes de a mensagem sair.");
    await prisma.lead.update({ where: { id: leadId }, data: { status: "NEEDS_HUMAN", needsHumanReason: TAKEOVER_REASON } });
  } else if (kind === "handback") {
    const replied = await prisma.message.count({ where: { leadId, sender: "LEAD" } });
    await prisma.lead.update({
      where: { id: leadId },
      data: { status: replied > 0 ? "CONVERSATION_OPEN" : "WAITING_REPLY", needsHumanReason: null, followUpsSent: 0, meetingAt: null },
    });
  } else if (kind === "lost") {
    await prisma.lead.update({ where: { id: leadId }, data: { status: "LOST", needsHumanReason: null } });
  }
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/");
  return { ok: true, previous: lead.status };
}

// Reunião marcada (por você, ou pelo lead na sua agenda). A data é opcional: vem do
// campo "datetime-local" (sem fuso), que tratamos como horário de Brasília.
// Depois disso o assistente não escreve mais nesta conversa.
export async function markMeeting(leadId: string, when: string | null) {
  await requireSession();
  let meetingAt: Date | null = null;
  if (when) {
    // Formato exato do campo (AAAA-MM-DDTHH:MM): o parser de datas do JS aceita lixo demais.
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(when.slice(0, 16))) return { error: "Data inválida." };
    meetingAt = new Date(`${when.slice(0, 16)}:00-03:00`);
    if (Number.isNaN(meetingAt.getTime())) return { error: "Data inválida." };
  }
  await supersedeDrafts(leadId);
  await prisma.lead.update({
    where: { id: leadId },
    data: { status: "MEETING_SCHEDULED", meetingAt, meetingReminders: [], needsHumanReason: null, nextStep: "Reunião marcada.", nextStepAt: null },
  });
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/conversations");
  revalidatePath("/");
  return { ok: true };
}

// Resultado depois da reunião (aconteceu, faltou, proposta, ganhou, perdeu), com valor e motivo.
// Perdeu/faltou não mexem no status da conversa; o histórico de cada mudança fica sozinho (gatilho do banco).
export async function setDeal(leadId: string, stage: string, value: string, reason: string) {
  await requireSession();
  const dealStage = parseDealStage(stage);
  const dealValueCents = parseMoneyCents(value);
  if (dealValueCents === undefined) return { error: "Valor inválido. Escreva só números, por exemplo 1.500,00." };
  await prisma.lead.update({
    where: { id: leadId },
    data: { dealStage, dealValueCents: dealStage ? dealValueCents : null, dealReason: dealStage ? reason.trim().slice(0, 300) || null : null },
  });
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/");
  return { ok: true };
}

// Renovação do contrato: vencimento (qualquer formato de data) e descrição. Vazio apaga.
export async function setRenewal(leadId: string, date: string, note: string) {
  await requireSession();
  const day = date.trim() ? parseRenewalDate(date) : null;
  if (date.trim() && !day) return { error: "Não entendi a data. Use, por exemplo, 15/03/2027." };
  await prisma.lead.update({ where: { id: leadId }, data: { renewalAt: day ? renewalDate(day) : null, renewalNote: day ? note.trim().slice(0, 300) || null : null } });
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/");
  return { ok: true };
}

// "Renovou": o vencimento anda um ano e a anotação registra o dia. "Não renova": tira da lista e anota.
export async function resolveRenewal(leadId: string, renewed: boolean) {
  await requireSession();
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId }, select: { renewalAt: true, notes: true } });
  if (!lead.renewalAt) return { error: "Esta pessoa não tem vencimento na ficha." };
  const due = formatISO(renewalISO(lead.renewalAt));
  const notes = appendNote(lead.notes, renewed ? `Renovou o contrato que vencia em ${due}.` : `Não vai renovar o contrato que vencia em ${due}.`);
  await prisma.lead.update({ where: { id: leadId }, data: { notes, renewalAt: renewed ? renewalDate(addYear(renewalISO(lead.renewalAt) < todayISO() ? todayISO() : renewalISO(lead.renewalAt))) : null, ...(renewed ? {} : { renewalNote: null }) } });
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/");
  return { ok: true };
}

// Lembretes da pessoa.
export async function addLeadTask(leadId: string, title: string, due: string) {
  await requireSession();
  const t = title.trim().slice(0, 160);
  if (!t) return { error: "Escreva o que lembrar." };
  const day = due ? validDue(due, todaySP()) : null;
  if (due && !day) return { error: "Data inválida. Use uma data de hoje em diante." };
  await prisma.leadTask.create({ data: { leadId, title: t, dueAt: day ? dueDate(day) : null } });
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/");
  return { ok: true };
}

// "Lembrar de retornar": cria o lembrete para daqui a alguns dias (amanhã, 3 dias, 1 semana).
export async function remindLead(leadId: string, days: number) {
  await requireSession();
  if (!REMIND_OPTIONS.some((o) => o.days === days)) return { error: "Prazo inválido." };
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { firstName: true } });
  if (!lead) return { error: "Contato não encontrado." };
  const target = new Date(`${todaySP()}T12:00:00Z`);
  target.setUTCDate(target.getUTCDate() + days);
  await prisma.leadTask.create({ data: { leadId, title: `Retornar para ${lead.firstName ?? "a pessoa"}`, dueAt: dueDate(target.toISOString().slice(0, 10)) } });
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/");
  return { ok: true };
}

export async function setLeadTaskDone(taskId: string, done: boolean) {
  await requireSession();
  const task = await prisma.leadTask.update({ where: { id: taskId }, data: { doneAt: done ? new Date() : null }, select: { leadId: true } });
  revalidatePath(`/leads/${task.leadId}`);
  revalidatePath("/");
  return { ok: true };
}

export async function deleteLeadTask(taskId: string) {
  await requireSession();
  const task = await prisma.leadTask.delete({ where: { id: taskId }, select: { leadId: true } });
  revalidatePath(`/leads/${task.leadId}`);
  revalidatePath("/");
  return { ok: true };
}

// Aplica só o que o corretor marcou na prévia da atualização por voz. A proposta volta do navegador, então passa de novo pelas regras.
export async function applyVoiceUpdate(leadId: string, rawProposal: unknown, picks: { note: boolean; personal: boolean; tasks: number[]; deal: boolean }) {
  await requireSession();
  const proposal = sanitizeProposal(rawProposal);
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { notes: true, personal: true } });
  if (!lead) return { error: "Contato não encontrado." };

  const data: Prisma.LeadUpdateInput = {};
  if (picks.note && proposal.note) data.notes = appendNote(lead.notes, proposal.note);
  if (picks.personal && proposal.personal) data.personal = appendPersonal(lead.personal, proposal.personal).slice(0, 2000);
  if (picks.deal && proposal.deal) {
    data.dealStage = proposal.deal.stage;
    data.dealValueCents = proposal.deal.valueCents;
    data.dealReason = proposal.deal.reason;
  }
  const tasks = picks.tasks.filter((i) => Number.isInteger(i)).map((i) => proposal.tasks[i]).filter(Boolean);
  await prisma.$transaction([
    ...(Object.keys(data).length ? [prisma.lead.update({ where: { id: leadId }, data })] : []),
    ...tasks.map((t) => prisma.leadTask.create({ data: { leadId, title: t.title, dueAt: t.due ? dueDate(t.due) : null, source: "AUDIO" } })),
  ]);
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/");
  return { ok: true };
}

async function leadWithHistory(leadId: string) {
  return prisma.lead.findUniqueOrThrow({
    where: { id: leadId },
    include: { messages: { orderBy: { deliveredAt: "asc" }, select: { sender: true, content: true, deliveredAt: true, channel: true, openToken: true, openCount: true } } },
  });
}

// "Não precisava passar pra mim": ensina o assistente a responder esse tipo de conversa sozinho
// e já devolve a conversa a ele (senão o aviso ficava lá e a automação continuava pausada).
export async function markHandoffFeedback(leadId: string, reasons: string[], note: string): Promise<{ error?: string }> {
  await requireSession();
  const result = await recordFeedback({ leadId, reasons, note });
  revalidatePath("/settings");
  if (!result.error) await leadAction(leadId, "handback");
  return result;
}

export async function summarizeLead(leadId: string): Promise<{ text?: string; error?: string }> {
  await requireSession();
  try {
    const lead = await leadWithHistory(leadId);
    if (lead.messages.length === 0) return { error: "Ainda não há mensagens pra resumir." };
    return { text: await summarizeConversation(lead, lead.messages) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Não foi possível gerar o resumo." };
  }
}

// Roteiro para a reunião marcada: contexto, necessidade, objeções, participantes e o que confirmar.
export async function prepareLeadMeeting(leadId: string): Promise<{ text?: string; error?: string }> {
  await requireSession();
  try {
    const lead = await leadWithHistory(leadId);
    if (!lead.meetingAt) return { error: "Essa conversa não tem reunião marcada." };
    const when = lead.meetingAt.toLocaleString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
    return { text: await prepareMeeting(lead, lead.messages, { when, notes: lead.notes }) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Não foi possível preparar a reunião." };
  }
}

// intent = uma das ações prontas (pedir documentos, convidar, confirmar passos, retomar); sem ela, responde ao que a pessoa disse.
export async function suggestLeadReply(leadId: string, channel: MessageChannel = "LINKEDIN", intent?: string): Promise<{ text?: string; error?: string }> {
  await requireSession();
  try {
    const lead = await leadWithHistory(leadId);
    const settings = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } });
    const base = isReplyIntent(intent) ? REPLY_INTENTS[intent].goal : undefined;
    const goal = base && intent === "renew" && lead.renewalAt ? `${base} Dados da ficha: ${lead.renewalNote ?? "contrato"}, vence em ${formatISO(renewalISO(lead.renewalAt))}.` : base;
    return { text: await suggestReply(await instructionsFor(lead, settings, { task: goal ? `escrever uma mensagem: ${goal}` : "sugerir a próxima resposta ao lead", history: lead.messages }), lead, lead.messages, channel === "EMAIL" || channel === "WHATSAPP" ? channel : "LINKEDIN", goal) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Não foi possível sugerir uma resposta." };
  }
}

// Regra de follow-up só desta conversa (null = volta pra da campanha/conta).
export async function updateLeadFollowUp(leadId: string, value: { count: number; days: number } | null) {
  await requireSession();
  if (value && !validFollowUp(value.count, value.days * 24)) return { error: "Valores fora do permitido." };
  await prisma.lead.update({
    where: { id: leadId },
    data: { followUpMaxCount: value?.count ?? null, followUpDelayHours: value ? value.days * 24 : null },
  });
  revalidatePath(`/leads/${leadId}`);
  return { saved: true };
}

// Ficha pessoal: canais (e-mail, WhatsApp) e o que o corretor sabe da pessoa.
// O assistente usa isso pra escolher o canal e personalizar as mensagens.
export async function updateLeadProfile(leadId: string, data: { email: string; phone: string; personal: string; kind: string; referredBy: string }) {
  await requireSession();
  const e = parseEmail(data.email);
  if ("error" in e) return { error: e.error };
  if (e.email && (await checkEmailDomain(domainOf(e.email))) === "sem_servidor") return { error: noMailMessage(domainOf(e.email)) };
  const p = parsePhone(data.phone);
  if ("error" in p) return { error: p.error };
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      email: e.email,
      phone: p.phone,
      personal: data.personal.trim().slice(0, 2000) || null,
      kind: parseLeadKind(data.kind),
      referredBy: data.referredBy.trim().slice(0, 120) || null,
    },
  });
  revalidatePath(`/leads/${leadId}`);
  return { saved: true };
}

// Abordagem: "em conversa com outra IA" (a secretária não entra) e "não quer
// mais contato" (nada automático sai mais pra essa pessoa).
export async function setLeadOutreach(leadId: string, field: "otherAiActive" | "doNotContact", value: boolean) {
  await requireSession();
  if (field !== "otherAiActive" && field !== "doNotContact") return;
  await prisma.lead.update({ where: { id: leadId }, data: { [field]: value } });
  revalidatePath(`/leads/${leadId}`);
}

// Preferência de canal: por qual a pessoa gosta de ser chamada e em quais pediu para não ser abordada.
export async function setChannelPrefs(leadId: string, preferred: string, blocked: string[]) {
  await requireSession();
  const valid = (c: unknown): c is MessageChannel => c === "LINKEDIN" || c === "EMAIL" || c === "WHATSAPP";
  const blockedChannels = [...new Set(blocked.filter(valid))];
  const preferredChannel = valid(preferred) && !blockedChannels.includes(preferred) ? preferred : null;
  await prisma.lead.update({ where: { id: leadId }, data: { preferredChannel, blockedChannels } });
  revalidatePath(`/leads/${leadId}`);
  return { preferredChannel, blockedChannels };
}

// A pessoa faltou à reunião: o assistente manda o "senti sua falta" (texto de
// Conta → Lembretes da reunião) e a conversa volta a andar pra remarcar.
export async function markNoShow(leadId: string): Promise<{ error?: string }> {
  await requireSession();
  const [lead, settings, identityId] = await Promise.all([
    prisma.lead.findUniqueOrThrow({ where: { id: leadId }, include: { messages: { orderBy: { deliveredAt: "asc" }, select: { sender: true, channel: true } } } }),
    prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } }),
    activeIdentityIdOrNull(),
  ]);
  if (lead.status !== "MEETING_SCHEDULED") return { error: "Essa conversa não está com reunião marcada." };
  try {
    await sendNoShow(lead, identityId, settings);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "A mensagem não saiu." };
  }
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      status: "CONVERSATION_OPEN",
      meetingAt: null,
      meetingLink: null,
      meetingReminders: [],
      needsHumanReason: null,
      nextStep: "Faltou à reunião; perguntei se quer marcar outro horário.",
      nextStepAt: null,
    },
  });
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/conversations");
  return {};
}
