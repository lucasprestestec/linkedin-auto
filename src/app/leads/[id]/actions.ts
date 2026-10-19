"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { activeIdentityIdOrNull } from "@/lib/identity";
import { sendOnChannel } from "@/lib/channels";
import { supersedeDrafts } from "@/lib/outbox";
import type { MessageChannel } from "@prisma/client";
import { summarizeConversation, suggestReply } from "@/lib/agent";
import { instructionsFor } from "@/lib/campaigns";
import { validFollowUp } from "@/lib/settings-ranges";
import { parseLeadKind } from "@/lib/leadKind";
import { parseEmail, parsePhone } from "@/lib/contactFields";
import { recordFeedback } from "@/lib/agentFeedback";
import { requireSession } from "@/lib/session";
import { sendNoShow } from "@/lib/meetingReminders";

// Motivo gravado quando o corretor assume: enquanto ele não devolver, nem uma resposta manual religa a IA.
const TAKEOVER_REASON = "Você assumiu a conversa";

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

export async function suggestLeadReply(leadId: string, channel: MessageChannel = "LINKEDIN"): Promise<{ text?: string; error?: string }> {
  await requireSession();
  try {
    const lead = await leadWithHistory(leadId);
    const settings = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } });
    return { text: await suggestReply(await instructionsFor(lead, settings, { task: "sugerir a próxima resposta ao lead", history: lead.messages }), lead, lead.messages, channel === "EMAIL" || channel === "WHATSAPP" ? channel : "LINKEDIN") };
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
