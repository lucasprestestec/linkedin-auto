import type { Lead, MessageChannel, Settings } from "@prisma/client";
import { effectiveLimits, messagesSentToday } from "@/lib/limits";
import { prisma } from "@/lib/prisma";
import { sendOnChannel } from "@/lib/channels";
import { fillTemplate } from "@/lib/cadence";

// Lembretes da reunião pro lead: véspera, 5 horas antes e 1 hora antes, e o
// "senti sua falta" quando o corretor marca que a pessoa faltou. Textos fixos
// (editáveis em Conta), preenchidos sem IA e enviados no canal da conversa.

export const DEFAULT_REMINDERS = {
  day: "Oi, [NOME]! Passando para lembrar da nossa conversa amanhã, às [HORA], com [ESPECIALISTA]. Continua de pé?",
  "5h": "[NOME], nossa conversa é hoje, às [HORA]. Aqui está o link: [LINK]",
  "1h": "[NOME], daqui a uma hora a gente se fala. Até já!",
  noShow: "[NOME], senti sua falta na nossa conversa de hoje. Imagino que tenha surgido algum imprevisto. Quer que eu veja um novo horário?",
} as const;

export type ReminderKey = "day" | "5h" | "1h";

const HOUR_MS = 60 * 60 * 1000;
const TIME_ZONE = "America/Sao_Paulo";
// Acabou de marcar (a confirmação saiu há pouco): o lembrete da véspera/5h não faz sentido.
const JUST_BOOKED_MS = 6 * HOUR_MS;

function hourLabel(d: Date): string {
  const [h, m] = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE }).split(":");
  return m === "00" ? `${Number(h)}h` : `${Number(h)}h${m}`;
}

function dayKey(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
}

export function reminderTexts(settings: Pick<Settings, "reminderDayText" | "reminder5hText" | "reminder1hText" | "noShowText">) {
  return {
    day: settings.reminderDayText?.trim() || DEFAULT_REMINDERS.day,
    "5h": settings.reminder5hText?.trim() || DEFAULT_REMINDERS["5h"],
    "1h": settings.reminder1hText?.trim() || DEFAULT_REMINDERS["1h"],
    noShow: settings.noShowText?.trim() || DEFAULT_REMINDERS.noShow,
  };
}

// Preenche [NOME], [HORA], [DIA], [ESPECIALISTA] e [LINK]. Sem link de vídeo, a
// frase do link sai inteira. O que sobrar entre colchetes é tirado.
export function renderReminder(template: string, lead: Lead, ownerName: string | null): string {
  let text = template;
  if (lead.meetingAt) {
    text = text
      .replace(/\[\s*hora\s*\]/gi, hourLabel(lead.meetingAt))
      .replace(/\[\s*dia\s*\]/gi, lead.meetingAt.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: TIME_ZONE }));
  }
  text = text.replace(/\[\s*(?:nome do\s+)?especialista\s*\]/gi, ownerName?.trim() || "o nosso especialista");
  text = lead.meetingLink ? text.replace(/\[\s*link\s*\]/gi, lead.meetingLink) : text.replace(/[^.!?\n]*\[\s*link\s*\][^.!?\n]*[.!?]?/gi, "");
  text = fillTemplate(text, lead).text;
  return text
    .replace(/\[[^\]]{1,60}\]/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([,.!?])/g, "$1")
    .trim();
}

// Qual lembrete toca agora (o mais recente que já venceu); os anteriores que
// ficaram pra trás são dados como resolvidos sem enviar.
export function dueReminder(lead: Pick<Lead, "meetingAt" | "meetingReminders">, lastOutgoingAt: Date | null, now = new Date()): { send: ReminderKey | null; skip: ReminderKey[] } {
  if (!lead.meetingAt || lead.meetingAt.getTime() <= now.getTime()) return { send: null, skip: [] };
  const done = new Set(lead.meetingReminders);
  const until = lead.meetingAt.getTime() - now.getTime();
  // Recém-marcada: a última mensagem foi a confirmação (nenhum lembrete saiu ainda).
  const justBooked = done.size === 0 && lastOutgoingAt ? now.getTime() - lastOutgoingAt.getTime() < JUST_BOOKED_MS : false;
  const tomorrow = dayKey(lead.meetingAt) === dayKey(new Date(now.getTime() + 24 * HOUR_MS));

  let send: ReminderKey | null = null;
  const skip: ReminderKey[] = [];
  if (until <= HOUR_MS) {
    if (until > 5 * 60 * 1000 && !done.has("1h")) send = "1h";
    skip.push(...(["day", "5h"] as const).filter((k) => !done.has(k)));
  } else if (until <= 5 * HOUR_MS) {
    if (!done.has("5h")) {
      if (justBooked) skip.push("5h");
      else send = "5h";
    }
    if (!done.has("day")) skip.push("day");
  } else if (tomorrow && !done.has("day")) {
    if (justBooked) skip.push("day");
    else send = "day";
  }
  return { send, skip };
}

function conversationChannel(messages: { sender: string; channel: MessageChannel }[]): MessageChannel | null {
  return [...messages].reverse().find((m) => m.sender === "LEAD")?.channel ?? messages.at(-1)?.channel ?? null;
}

// Rodada do cron (dentro do horário de trabalho).
export async function sendMeetingReminders(identityId: string | null, settings: Settings): Promise<number> {
  if (!settings.meetingRemindersEnabled) return 0;
  const texts = reminderTexts(settings);
  const leads = await prisma.lead.findMany({
    where: { status: "MEETING_SCHEDULED", meetingAt: { gt: new Date() }, otherAiActive: false, doNotContact: false },
    include: { messages: { orderBy: { deliveredAt: "asc" }, select: { sender: true, channel: true, deliveredAt: true } } },
  });
  let sent = 0;
  for (const lead of leads) {
    const lastOutgoing = lead.messages.filter((m) => m.sender !== "LEAD").at(-1)?.deliveredAt ?? null;
    const { send, skip } = dueReminder(lead, lastOutgoing);
    if (!send && skip.length === 0) continue;
    const resolved = [...lead.meetingReminders, ...skip];
    if (send) {
      const channel = conversationChannel(lead.messages);
      if (!channel) continue;
      // O limite diário protege a conta do LinkedIn: sem vaga, tenta de novo na próxima rodada.
      if (channel === "LINKEDIN" && (await messagesSentToday()) >= effectiveLimits(settings).linkedinMessages) continue;
      try {
        await sendOnChannel(lead, channel, renderReminder(texts[send], lead, settings.ownerName), { identityId });
        resolved.push(send);
        sent++;
      } catch (err) {
        // Não insiste a cada rodada: marca como resolvido e registra.
        console.error(`[lembrete] lead=${lead.id} ${send} não saiu:`, err instanceof Error ? err.message : err);
        resolved.push(send);
      }
    }
    await prisma.lead.update({ where: { id: lead.id }, data: { meetingReminders: [...new Set(resolved)] } });
  }
  return sent;
}

// O corretor marcou que a pessoa faltou: manda o "senti sua falta" e reabre a conversa.
export async function sendNoShow(lead: Lead & { messages: { sender: string; channel: MessageChannel }[] }, identityId: string | null, settings: Settings) {
  const channel = conversationChannel(lead.messages);
  if (!channel) throw new Error("Não há conversa com essa pessoa para mandar a mensagem.");
  await sendOnChannel(lead, channel, renderReminder(reminderTexts(settings).noShow, lead, settings.ownerName), { identityId });
}
