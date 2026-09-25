"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { sendMessage } from "@/lib/edges";
import { getActiveIdentityId } from "@/lib/identity";
import { summarizeConversation, suggestReply } from "@/lib/agent";
import { instructionsFor } from "@/lib/campaigns";
import { validFollowUp } from "@/lib/settings-ranges";

export async function sendReply(leadId: string, _prevState: { error?: string } | undefined, formData: FormData) {
  const content = String(formData.get("content") ?? "").trim();
  if (!content) return { error: "Escreva uma mensagem." };

  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });

  try {
    const identityId = await getActiveIdentityId();
    const result = await sendMessage(identityId, lead.linkedinProfileUrl, content);
    await prisma.message.create({
      data: {
        leadId: lead.id,
        sender: "HUMAN",
        content,
        linkedinMessageId: result.linkedin_message_id,
        deliveredAt: new Date(result.delivered_at),
      },
    });
    // "Conversando" só se o lead já respondeu alguma vez; senão, seguimos
    // aguardando a primeira resposta dele.
    const leadHasReplied = await prisma.message.count({ where: { leadId: lead.id, sender: "LEAD" } });
    await prisma.lead.update({
      where: { id: lead.id },
      data: { status: leadHasReplied > 0 ? "CONVERSATION_OPEN" : "WAITING_REPLY", needsHumanReason: null },
    });
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
  await prisma.lead.update({ where: { id: leadId }, data: { notes: notes.trim() || null } });
  revalidatePath(`/leads/${leadId}`);
  return { saved: true };
}

// Etiquetas: minúsculas, sem espaço sobrando, sem repetir, até 10 por lead.
export async function updateLeadTags(leadId: string, tags: string[]) {
  const clean = [...new Set(tags.map((t) => t.trim().toLowerCase().slice(0, 30)).filter(Boolean))].slice(0, 10);
  await prisma.lead.update({ where: { id: leadId }, data: { tags: clean } });
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/");
  return { tags: clean };
}

export async function updateLeadCampaign(leadId: string, campaignId: string | null) {
  await prisma.lead.update({ where: { id: leadId }, data: { campaignId } });
  revalidatePath(`/leads/${leadId}`);
  return { saved: true };
}

// ---------------------------------------------------------------------------
// Ações do corretor sobre o lead (menu "Mais ações" e card de handoff).
// ---------------------------------------------------------------------------

export type LeadActionKind = "qualify" | "takeover" | "handback" | "lost";

export async function leadAction(leadId: string, kind: LeadActionKind) {
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
  if (kind === "qualify") {
    await prisma.lead.update({ where: { id: leadId }, data: { status: "QUALIFIED", needsHumanReason: null } });
  } else if (kind === "takeover") {
    // Assumir = a IA para de responder esta conversa até você devolver.
    await prisma.lead.update({ where: { id: leadId }, data: { status: "NEEDS_HUMAN", needsHumanReason: "Você assumiu a conversa" } });
  } else if (kind === "handback") {
    const replied = await prisma.message.count({ where: { leadId, sender: "LEAD" } });
    await prisma.lead.update({
      where: { id: leadId },
      data: { status: replied > 0 ? "CONVERSATION_OPEN" : "WAITING_REPLY", needsHumanReason: null, followUpsSent: 0 },
    });
  } else if (kind === "lost") {
    await prisma.lead.update({ where: { id: leadId }, data: { status: "LOST", needsHumanReason: null } });
  }
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/");
  return { ok: true, previous: lead.status };
}

async function leadWithHistory(leadId: string) {
  return prisma.lead.findUniqueOrThrow({
    where: { id: leadId },
    include: { messages: { orderBy: { deliveredAt: "asc" }, select: { sender: true, content: true } } },
  });
}

export async function summarizeLead(leadId: string): Promise<{ text?: string; error?: string }> {
  try {
    const lead = await leadWithHistory(leadId);
    if (lead.messages.length === 0) return { error: "Ainda não há mensagens pra resumir." };
    return { text: await summarizeConversation(lead, lead.messages) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Não foi possível gerar o resumo." };
  }
}

export async function suggestLeadReply(leadId: string): Promise<{ text?: string; error?: string }> {
  try {
    const lead = await leadWithHistory(leadId);
    const settings = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } });
    return { text: await suggestReply(await instructionsFor(lead, settings), lead, lead.messages) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Não foi possível sugerir uma resposta." };
  }
}

// Regra de follow-up só desta conversa (null = volta pra da campanha/conta).
export async function updateLeadFollowUp(leadId: string, value: { count: number; days: number } | null) {
  if (value && !validFollowUp(value.count, value.days * 24)) return { error: "Valores fora do permitido." };
  await prisma.lead.update({
    where: { id: leadId },
    data: { followUpMaxCount: value?.count ?? null, followUpDelayHours: value ? value.days * 24 : null },
  });
  revalidatePath(`/leads/${leadId}`);
  return { saved: true };
}
