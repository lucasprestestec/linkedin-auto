import type { Draft, DraftKind, Lead, MessageChannel, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CHANNEL_LABEL, sendOnChannel } from "@/lib/channels";
import { activeIdentityIdOrNull } from "@/lib/identity";
import { markNeedsHuman } from "@/lib/handoff";
import { sendPush } from "@/lib/push";
import { isWithinWorkHours } from "@/lib/schedule";
import { deleteMeeting, type CreatedMeeting } from "@/lib/gcalendar";
import { bookMeeting, type BookingPlan } from "@/lib/scheduling";
import { formatSlot } from "@/lib/slots";

// Modo piloto: um lugar só onde a secretária "manda uma mensagem". Com a
// aprovação ligada (Settings.approvalMode) a mensagem vira um rascunho pro
// corretor aprovar; desligada, sai na hora, como sempre foi. Em qualquer dos
// dois casos, o que muda no lead ao mandar (status, follow-ups, próximo passo)
// é o mesmo: vai em "effects" e é aplicado quando a mensagem realmente sai.

export type LeadEffects = Prisma.LeadUncheckedUpdateInput;

// Rascunhos pendentes demais = ninguém está olhando; a secretária para de gerar.
export const MAX_PENDING_DRAFTS = 20;
// Rascunho que ninguém decidiu em 2 dias perde a validade (a conversa andou).
const DRAFT_TTL_MS = 48 * 60 * 60 * 1000;
// Aprovado fora do horário espera a janela; o cron só reenvia depois disso, pra não
// pegar um rascunho que a própria aprovação está enviando neste instante.
const APPROVED_GRACE_MS = 2 * 60 * 1000;

// Rascunhos que ainda "seguram" o lead: ele não recebe nada novo por outro caminho.
export const OPEN_DRAFT_FILTER = { drafts: { none: { status: { in: ["PENDING", "APPROVED"] as ("PENDING" | "APPROVED")[] } } } };

export async function approvalModeOn(): Promise<boolean> {
  const s = await prisma.settings.findUnique({ where: { id: "singleton" }, select: { approvalMode: true } });
  return s?.approvalMode ?? true;
}

export interface DeliverOptions {
  kind: DraftKind;
  effects: LeadEffects;
  identityId?: string | null;
  subject?: string;
  // Uma linha: por que a secretária escreveu isso (aparece na aprovação).
  reason?: string | null;
  // Quem chama já sabe o modo (evita uma leitura por mensagem).
  approval?: boolean;
  // Reunião a marcar no Google Agenda junto com a mensagem (a confirmação ao lead).
  booking?: BookingPlan;
}

// O que efetivamente acontece ao "enviar": marca a reunião (se houver), manda a
// mensagem e aplica as mudanças no lead. A reunião só é criada aqui, na hora do
// envio: rascunho descartado ou vencido não deixa evento sobrando na agenda. Se a
// mensagem não sair, o evento é apagado.
async function sendNow(
  lead: Lead,
  channel: MessageChannel,
  content: string,
  opts: { identityId?: string | null; subject?: string; effects: LeadEffects; booking?: BookingPlan | null },
): Promise<void> {
  let text = content;
  let effects = opts.effects;
  let meeting: CreatedMeeting | null = null;

  if (opts.booking) {
    const settings = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } });
    meeting = await bookMeeting(lead, opts.booking, settings);
    // Sem e-mail na ficha o Google não manda convite: o link da videochamada vai na própria mensagem.
    if (meeting.meetLink) text = `${content}\n\n${meeting.meetLink}`;
    effects = {
      ...effects,
      status: "MEETING_SCHEDULED",
      meetingAt: new Date(opts.booking.startIso),
      googleEventId: meeting.id,
      meetingLink: meeting.meetLink,
      slotsProposedAt: null,
      needsHumanReason: null,
      nextStep: `Reunião marcada para ${formatSlot(new Date(opts.booking.startIso))}.`,
      nextStepAt: null,
    };
  }

  try {
    await sendOnChannel(lead, channel, text, { identityId: opts.identityId, subject: opts.subject });
  } catch (err) {
    if (meeting) await deleteMeeting(meeting.id).catch((e) => console.error("Não consegui apagar a reunião após falha no envio", e));
    throw err;
  }
  await prisma.lead.update({ where: { id: lead.id }, data: effects });
}

export async function deliver(lead: Lead, channel: MessageChannel, content: string, opts: DeliverOptions): Promise<"sent" | "queued"> {
  const approval = opts.approval ?? (await approvalModeOn());
  if (!approval) {
    await sendNow(lead, channel, content, opts);
    return "sent";
  }

  await prisma.draft.create({
    data: {
      leadId: lead.id,
      kind: opts.kind,
      channel,
      subject: opts.subject ?? null,
      content,
      reason: opts.reason?.slice(0, 300) ?? null,
      effects: JSON.parse(JSON.stringify(opts.effects)) as Prisma.InputJsonValue,
      ...(opts.booking ? { booking: opts.booking as unknown as Prisma.InputJsonValue } : {}),
    },
  });
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Um lead";
  // Aviso é acessório: falha nele não desfaz o rascunho.
  await sendPush({
    title: `Aprove a mensagem para ${name}`,
    body: `${CHANNEL_LABEL[channel]}: ${content.slice(0, 90)}`,
    url: "/approvals",
    tag: `draft-${lead.id}`,
  }).catch((err) => console.error("Falha ao avisar rascunho", err));
  return "queued";
}

// O lead escreveu de novo: o que estava esperando aprovação ficou velho.
export async function supersedeDrafts(leadId: string): Promise<void> {
  await prisma.draft.updateMany({
    where: { leadId, status: { in: ["PENDING", "APPROVED"] } },
    data: { status: "DISCARDED", decidedAt: new Date(), error: "O lead escreveu de novo antes de a mensagem sair." },
  });
}

export async function pendingDraftCount(): Promise<number> {
  return prisma.draft.count({ where: { status: "PENDING" } });
}

export async function expireDrafts(): Promise<number> {
  const r = await prisma.draft.updateMany({
    where: { status: "PENDING", createdAt: { lt: new Date(Date.now() - DRAFT_TTL_MS) } },
    data: { status: "EXPIRED", decidedAt: new Date() },
  });
  return r.count;
}

type SendResult = { ok: true } | { ok: false; error: string };

// Envia um rascunho já aprovado e aplica o que muda no lead.
async function sendApproved(draft: Draft): Promise<SendResult> {
  const lead = await prisma.lead.findUnique({ where: { id: draft.leadId } });
  if (!lead) {
    await prisma.draft.update({ where: { id: draft.id }, data: { status: "FAILED", error: "Lead não existe mais." } });
    return { ok: false, error: "Lead não existe mais." };
  }

  // O lead escreveu depois de a mensagem ser escrita: ela responderia a uma conversa que andou.
  const replied = await prisma.message.count({ where: { leadId: lead.id, sender: "LEAD", deliveredAt: { gt: draft.createdAt } } });
  if (replied > 0) {
    const error = "O lead respondeu depois de a mensagem ser escrita. Confira a conversa.";
    await prisma.draft.update({ where: { id: draft.id }, data: { status: "DISCARDED", error, decidedAt: new Date() } });
    return { ok: false, error };
  }

  try {
    const identityId = draft.channel === "LINKEDIN" ? await activeIdentityIdOrNull() : null;
    await sendNow(lead, draft.channel, draft.content, {
      identityId,
      subject: draft.subject ?? undefined,
      effects: draft.effects as LeadEffects,
      booking: draft.booking as unknown as BookingPlan | null,
    });
    await prisma.draft.update({ where: { id: draft.id }, data: { status: "SENT", decidedAt: new Date(), error: null } });
    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : "erro desconhecido";
    await prisma.draft.update({ where: { id: draft.id }, data: { status: "FAILED", error } });
    await markNeedsHuman(lead.id, `Falha ao enviar a mensagem aprovada: ${error}`);
    return { ok: false, error };
  }
}

export type ApproveResult = { error: string } | { status: "sent" | "waiting" };

// Aprova (com o texto editado, se o corretor mudou). Dentro do horário de
// trabalho sai na hora; fora dele, espera a janela abrir.
export async function approveDraft(id: string, editedContent?: string): Promise<ApproveResult> {
  const draft = await prisma.draft.findUnique({ where: { id } });
  if (!draft || draft.status !== "PENDING") return { error: "Essa mensagem já foi tratada." };
  const content = (editedContent ?? draft.content).trim();
  if (!content) return { error: "A mensagem está vazia." };

  // Reserva antes de enviar: dois cliques (ou duas abas) não mandam duas vezes.
  const claimed = await prisma.draft.updateMany({
    where: { id, status: "PENDING" },
    data: {
      status: "APPROVED",
      content,
      edited: draft.edited || content !== draft.content,
      // Guarda o que o assistente escreveu quando o corretor muda o texto (base das sugestões de regra).
      ...(content !== draft.content && draft.originalContent == null ? { originalContent: draft.content } : {}),
      decidedAt: new Date(),
    },
  });
  if (claimed.count === 0) return { error: "Essa mensagem já foi tratada." };

  const settings = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } });
  if (!isWithinWorkHours(settings)) return { status: "waiting" };

  const approved = await prisma.draft.findUniqueOrThrow({ where: { id } });
  const result = await sendApproved(approved);
  return result.ok ? { status: "sent" } : { error: result.error };
}

// Descartar = "não é assim que eu falaria": a conversa passa a ser sua.
export async function discardDraft(id: string): Promise<{ error?: string }> {
  const draft = await prisma.draft.findUnique({ where: { id } });
  if (!draft) return { error: "Mensagem não encontrada." };
  const done = await prisma.draft.updateMany({ where: { id, status: "PENDING" }, data: { status: "DISCARDED", decidedAt: new Date() } });
  if (done.count === 0) return { error: "Essa mensagem já foi tratada." };
  await markNeedsHuman(draft.leadId, "Você descartou a mensagem do assistente — a conversa é sua");
  return {};
}

// Roda no cron, dentro do horário de trabalho: envia o que foi aprovado fora dele.
export async function flushApprovedDrafts(limit = 10): Promise<number> {
  const due = await prisma.draft.findMany({
    where: { status: "APPROVED", decidedAt: { lt: new Date(Date.now() - APPROVED_GRACE_MS) } },
    orderBy: { decidedAt: "asc" },
    take: limit,
  });
  let sent = 0;
  for (const draft of due) {
    if ((await sendApproved(draft)).ok) sent++;
  }
  return sent;
}

// Quantas das últimas mensagens decididas foram aprovadas sem mudar uma vírgula.
// Sinal de que a secretária já acerta o tom e a aprovação pode ser desligada.
export async function approvalStats(sample = 30): Promise<{ decided: number; untouched: number }> {
  const recent = await prisma.draft.findMany({
    where: { status: { in: ["SENT", "DISCARDED"] }, decidedAt: { not: null } },
    orderBy: { decidedAt: "desc" },
    take: sample,
    select: { status: true, edited: true, error: true },
  });
  // Descartada porque o lead respondeu antes não conta contra a secretária.
  const counted = recent.filter((d) => !(d.status === "DISCARDED" && d.error));
  return { decided: counted.length, untouched: counted.filter((d) => d.status === "SENT" && !d.edited).length };
}
