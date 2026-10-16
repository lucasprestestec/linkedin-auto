"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { approveDraft, discardDraft, type ApproveResult } from "@/lib/outbox";
import { recordFeedback } from "@/lib/agentFeedback";
import { requireSession } from "@/lib/session";
import { ensureAudio } from "@/lib/voice/send";
import { speechIssues } from "@/lib/voice/speech";
import { VoiceError } from "@/lib/voice/fish";
import { hasVoice, parseVoiceSettings } from "@/lib/voice/settings";

function refresh() {
  revalidatePath("/approvals");
  revalidatePath("/assistente");
  revalidatePath("/conversations");
  revalidatePath("/");
  revalidatePath("/leads/[id]", "page");
}

// Aprova (com o texto editado, se o corretor mudou). Fora do horário de
// trabalho a mensagem fica aprovada e sai quando a janela abrir.
export async function approve(id: string, content: string): Promise<ApproveResult> {
  const result = await approveDraft(id, content);
  refresh();
  return result;
}

export async function discard(id: string): Promise<{ error?: string }> {
  const result = await discardDraft(id);
  refresh();
  return result;
}

// "Não é meu jeito": só registra o motivo (a mensagem continua esperando a sua decisão).
export async function markDraftFeedback(draftId: string, reasons: string[], note: string): Promise<{ error?: string }> {
  await requireSession();
  const result = await recordFeedback({ draftId, reasons, note });
  revalidatePath("/settings");
  revalidatePath("/assistente");
  return result;
}

// Ouvir o áudio de um rascunho antes de aprovar. O áudio gerado aqui é o mesmo que sai depois (se o
// texto não mudar), então não se paga duas vezes.
export async function previewDraftAudio(id: string, text: string): Promise<{ url?: string; error?: string }> {
  await requireSession();
  const draft = await prisma.draft.findUnique({ where: { id }, select: { status: true, asAudio: true, channel: true } });
  if (!draft || draft.status !== "PENDING") return { error: "Essa mensagem já foi tratada." };
  if (!draft.asAudio || draft.channel !== "WHATSAPP") return { error: "Essa mensagem vai em texto." };
  const content = text.trim();
  const issues = speechIssues(content);
  if (issues.length) return { error: `Esse texto não vai em áudio: ${issues[0]}. Ajuste o texto ou envie como texto.` };
  try {
    const { token } = await ensureAudio(content, { draftId: id });
    return { url: `/api/audio/${token}` };
  } catch (err) {
    return { error: err instanceof VoiceError ? err.message : "Não consegui gerar o áudio agora." };
  }
}

// Trocar o envio de um rascunho entre áudio e texto.
export async function setDraftAudio(id: string, on: boolean): Promise<{ error?: string }> {
  await requireSession();
  const draft = await prisma.draft.findUnique({ where: { id }, select: { status: true, channel: true } });
  if (!draft || draft.status !== "PENDING") return { error: "Essa mensagem já foi tratada." };
  if (on && draft.channel !== "WHATSAPP") return { error: "Áudio só funciona no WhatsApp." };
  if (on) {
    const s = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" }, select: { voiceSettings: true } });
    if (!hasVoice(parseVoiceSettings(s.voiceSettings))) return { error: "Crie a sua voz antes (Conta → Mensagens de voz)." };
  }
  await prisma.draft.update({ where: { id }, data: { asAudio: on } });
  revalidatePath("/approvals");
  revalidatePath("/assistente");
  return {};
}

export async function setApprovalMode(on: boolean) {
  await prisma.settings.update({ where: { id: "singleton" }, data: { approvalMode: on } });
  refresh();
}

// Revisão de campanha nova: liga/desliga e os dois limites (dias e mensagens).
export async function updateCampaignReview(data: { on: boolean; days: number; messages: number }): Promise<{ error?: string }> {
  await requireSession();
  const days = Math.round(data.days);
  const messages = Math.round(data.messages);
  if (!(days >= 1 && days <= 90) || !(messages >= 1 && messages <= 500)) return { error: "Use de 1 a 90 dias e de 1 a 500 mensagens." };
  await prisma.settings.update({ where: { id: "singleton" }, data: { campaignReview: data.on, campaignReviewDays: days, campaignReviewMessages: messages } });
  refresh();
  revalidatePath("/campaigns/[id]", "page");
  return {};
}

// O corretor libera a campanha antes do prazo: daqui pra frente segue a aprovação geral.
export async function releaseCampaignReview(campaignId: string) {
  await requireSession();
  await prisma.campaign.update({ where: { id: campaignId }, data: { reviewReleasedAt: new Date() } });
  refresh();
  revalidatePath(`/campaigns/${campaignId}`);
}
