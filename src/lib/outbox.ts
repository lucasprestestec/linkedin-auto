import type { Draft, DraftKind, Lead, MessageChannel, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CHANNEL_NAME, isBlocked } from "@/lib/channelPrefs";
import { CHANNEL_LABEL, sendOnChannel } from "@/lib/channels";
import { activeIdentityIdOrNull } from "@/lib/identity";
import { markNeedsHuman } from "@/lib/handoff";
import { sendPush } from "@/lib/push";
import { isWithinWorkHours } from "@/lib/schedule";
import { deleteMeeting, type CreatedMeeting } from "@/lib/gcalendar";
import { bookMeeting, type BookingPlan } from "@/lib/scheduling";
import { formatSlot } from "@/lib/slots";
import { sendAudioMessage } from "@/lib/voice/send";
import { campaignReviewNote } from "@/lib/campaignReview";
import { notifyTeam } from "@/lib/team";
import { effectiveLimits, messagesSentToday, whatsappSentToday, type Db } from "@/lib/limits";
import { emailLeftToday } from "@/lib/mailboxes";

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
// Reservado para envio e sem desfecho depois disso: o envio morreu no meio.
const STUCK_SENDING_MS = 10 * 60 * 1000;

// Rascunhos que ainda "seguram" o lead: ele não recebe nada novo por outro caminho.
export const OPEN_DRAFT_FILTER = { drafts: { none: { status: { in: ["PENDING", "APPROVED", "SENDING"] as ("PENDING" | "APPROVED" | "SENDING")[] } } } };

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
  // Sai como mensagem de voz (WhatsApp). Se o áudio falhar, sai o texto.
  asAudio?: boolean;
  // Vai pra aprovação mesmo com ela desligada; o texto diz por quê (ex.: a IA ficou em dúvida).
  forceApproval?: string;
}

// O que efetivamente acontece ao "enviar": marca a reunião (se houver), manda a
// mensagem e aplica as mudanças no lead. A reunião só é criada aqui, na hora do
// envio: rascunho descartado ou vencido não deixa evento sobrando na agenda. Se a
// mensagem não sair, o evento é apagado.
async function sendNow(
  lead: Lead,
  channel: MessageChannel,
  content: string,
  opts: { identityId?: string | null; subject?: string; effects: LeadEffects; booking?: BookingPlan | null; asAudio?: boolean; draftId?: string },
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
      // Reunião nova: os lembretes (véspera, 5h, 1h) começam do zero.
      meetingReminders: [],
      needsHumanReason: null,
      nextStep: `Reunião marcada para ${formatSlot(new Date(opts.booking.startIso))}.`,
      nextStepAt: null,
    };
  }

  try {
    let sentAsAudio = false;
    // Mensagem de voz só no WhatsApp e nunca junto com reunião (o link precisa ir escrito). Qualquer
    // falha no caminho do áudio (voz, serviço, endereço, WhatsApp) cai pro texto: a resposta sempre sai.
    if (opts.asAudio && channel === "WHATSAPP" && !opts.booking) {
      try {
        await sendAudioMessage(lead, text, { draftId: opts.draftId });
        sentAsAudio = true;
      } catch (err) {
        console.error(`[voz] áudio não saiu (lead=${lead.id}); mandando em texto:`, err instanceof Error ? err.message : err);
      }
    }
    if (!sentAsAudio) await sendOnChannel(lead, channel, text, { identityId: opts.identityId, subject: opts.subject });
  } catch (err) {
    if (meeting) await deleteMeeting(meeting.id).catch((e) => console.error("Não consegui apagar a reunião após falha no envio", e));
    throw err;
  }
  await prisma.lead.update({ where: { id: lead.id }, data: effects });
  if (opts.booking) {
    const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Um lead";
    await notifyTeam("meeting", { title: `Reunião marcada com ${name}`, body: `${formatSlot(new Date(opts.booking.startIso))} (${opts.booking.minutes} min, por vídeo).`, leadId: lead.id });
  }
}

export async function deliver(lead: Lead, channel: MessageChannel, content: string, opts: DeliverOptions): Promise<"sent" | "queued"> {
  // Canal que a pessoa bloqueou: o assistente não puxa conversa por ele (responder a quem escreveu por lá segue valendo).
  if (opts.kind !== "REPLY" && isBlocked(lead, channel)) throw new Error(`A pessoa pediu para não ser abordada pelo ${CHANNEL_NAME[channel]}.`);
  let approval = opts.approval ?? (await approvalModeOn());
  // Com a aprovação geral desligada, ainda passam pelo corretor: a mensagem em
  // que a IA ficou em dúvida e as de campanha nova em revisão.
  const why = approval ? null : (opts.forceApproval ?? (await campaignReviewNote(lead.campaignId)));
  if (why) approval = true;
  if (!approval) {
    await sendNow(lead, channel, content, opts);
    return "sent";
  }
  const reason = why ? [why, opts.reason].filter(Boolean).join(" · ") : opts.reason;

  await prisma.draft.create({
    data: {
      leadId: lead.id,
      kind: opts.kind,
      channel,
      subject: opts.subject ?? null,
      content,
      asAudio: Boolean(opts.asAudio) && channel === "WHATSAPP" && !opts.booking,
      reason: reason?.slice(0, 300) ?? null,
      effects: JSON.parse(JSON.stringify(opts.effects)) as Prisma.InputJsonValue,
      ...(opts.booking ? { booking: opts.booking as unknown as Prisma.InputJsonValue } : {}),
    },
  });
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Um lead";
  // Aviso é acessório: falha nele não desfaz o rascunho.
  await sendPush({
    title: `Aprove a mensagem para ${name}`,
    body: `${CHANNEL_LABEL[channel]}: ${content.slice(0, 90)}`,
    url: "/",
    tag: `draft-${lead.id}`,
  }).catch((err) => console.error("Falha ao avisar rascunho", err));
  return "queued";
}

// O lead escreveu de novo: o que estava esperando aprovação ficou velho.
export async function supersedeDrafts(leadId: string, reason = "O lead escreveu de novo antes de a mensagem sair."): Promise<void> {
  await prisma.draft.updateMany({
    where: { leadId, status: { in: ["PENDING", "APPROVED"] } },
    data: { status: "DISCARDED", decidedAt: new Date(), error: reason },
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

// deferred: não saiu porque o limite do dia acabou; continua aprovada e sai quando houver vaga.
type SendResult = { ok: true } | { ok: false; error: string; deferred?: true };

// O limite diário vale no momento de ENVIAR (não só quando o texto foi escrito): a fila de aprovados
// e a aprovação imediata não podem passar do que o canal aguenta. Resposta a quem escreveu não conta
// em e-mail/WhatsApp (mesma regra de respond.ts); no LinkedIn o limite protege a conta e vale sempre.
// Conta também o que está sendo enviado agora (SENDING) por outro robô.
async function overDailyLimit(draft: Draft, db: Db): Promise<boolean> {
  const settings = await db.settings.findUniqueOrThrow({ where: { id: "singleton" } });
  const limits = effectiveLimits(settings);
  const inFlight = await db.draft.count({ where: { status: "SENDING", channel: draft.channel, id: { not: draft.id } } });
  if (draft.channel === "LINKEDIN") return (await messagesSentToday(db)) + inFlight >= limits.linkedinMessages;
  if (draft.kind === "REPLY") return false;
  if (draft.channel === "WHATSAPP") return (await whatsappSentToday(db)) + inFlight >= limits.whatsapp;
  return (await emailLeftToday(settings, new Date(), db)) - inFlight <= 0;
}

// Confere a vaga do dia e reserva o rascunho (APPROVED -> SENDING) de uma vez, com trava no banco:
// dois envios simultâneos não usam a mesma última vaga, e o mesmo rascunho nunca é pego duas vezes.
async function claimForSending(draft: Draft): Promise<"ok" | "taken" | "limit"> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(73001)`;
    if (await overDailyLimit(draft, tx)) return "limit" as const;
    const claimed = await tx.draft.updateMany({ where: { id: draft.id, status: "APPROVED" }, data: { status: "SENDING", decidedAt: new Date() } });
    return claimed.count === 0 ? ("taken" as const) : ("ok" as const);
  });
}

// Envia um rascunho já aprovado e aplica o que muda no lead.
async function sendApproved(draft: Draft): Promise<SendResult> {
  const lead = await prisma.lead.findUnique({ where: { id: draft.leadId } });
  if (!lead) {
    await prisma.draft.update({ where: { id: draft.id }, data: { status: "FAILED", error: "Lead não existe mais." } });
    return { ok: false, error: "Lead não existe mais." };
  }

  // Quem se descadastrou não recebe mais nada, nem o que já estava aprovado.
  if (lead.doNotContact) {
    const error = "A pessoa pediu para não receber mais mensagens.";
    await prisma.draft.update({ where: { id: draft.id }, data: { status: "DISCARDED", error, decidedAt: new Date() } });
    return { ok: false, error };
  }

  // Outra IA assumiu a pessoa: a mensagem aprovada antes não sai.
  if (lead.otherAiActive) {
    const error = "A pessoa está em conversa com outra IA.";
    await prisma.draft.update({ where: { id: draft.id }, data: { status: "DISCARDED", error, decidedAt: new Date() } });
    return { ok: false, error };
  }

  // Bloqueou o canal depois de a mensagem ser aprovada: ela não sai.
  if (draft.kind !== "REPLY" && isBlocked(lead, draft.channel)) {
    const error = `A pessoa pediu para não ser abordada pelo ${CHANNEL_NAME[draft.channel]}.`;
    await prisma.draft.update({ where: { id: draft.id }, data: { status: "DISCARDED", error, decidedAt: new Date() } });
    return { ok: false, error };
  }

  // Sem vaga no dia: fica aprovada (não vira erro) e sai quando houver. Com vaga, reserva o rascunho.
  const claim = await claimForSending(draft);
  if (claim === "limit") return { ok: false, error: "Limite diário atingido: sai quando houver vaga.", deferred: true };
  if (claim === "taken") return { ok: false, error: "Essa mensagem já está sendo enviada." };

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
      asAudio: draft.asAudio,
      draftId: draft.id,
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
  if (!result.ok && result.deferred) return { status: "waiting" };
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
// Quem está sem vaga no dia é pulado (não toma o lugar de quem tem vaga em outro canal).
export async function flushApprovedDrafts(limit = 10): Promise<number> {
  // Reservado há muito tempo e nunca concluído: o robô caiu no meio. Não reenvia (poderia duplicar): avisa.
  const stuck = await prisma.draft.findMany({ where: { status: "SENDING", decidedAt: { lt: new Date(Date.now() - STUCK_SENDING_MS) } } });
  for (const d of stuck) {
    const error = "Não sei se esta mensagem saiu. Confira a conversa antes de mandar de novo.";
    await prisma.draft.update({ where: { id: d.id }, data: { status: "FAILED", error } });
    await markNeedsHuman(d.leadId, error).catch((err) => console.error("Falha ao avisar rascunho preso", err));
  }

  let sent = 0;
  let tried = 0;
  // Os sem vaga ficam na fila (deferred): a próxima página pula só eles, para não esconder os que têm vaga.
  let deferred = 0;
  for (let rounds = 0; rounds < 50 && tried < limit; rounds++) {
    const page = await prisma.draft.findMany({
      where: { status: "APPROVED", decidedAt: { lt: new Date(Date.now() - APPROVED_GRACE_MS) } },
      orderBy: { decidedAt: "asc" },
      skip: deferred,
      take: 50,
    });
    if (page.length === 0) break;
    for (const draft of page) {
      if (tried >= limit) break;
      const r = await sendApproved(draft);
      if (r.ok) sent++;
      if (!r.ok && r.deferred) deferred++;
      else tried++;
    }
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
