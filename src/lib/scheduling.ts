import type { Lead, Settings } from "@prisma/client";
import { calendarReady, createMeeting, listBusy, type CreatedMeeting } from "@/lib/gcalendar";
import type { CalendarContext } from "@/lib/agent";
import { checkSlot, describeWindows, formatSlot, freeStarts, slotIso, suggestSlots, type Busy, type SlotRules } from "@/lib/slots";

// Junta as regras do corretor (horário de atendimento, duração) com a agenda real
// do Google: o que a secretária pode oferecer e o que ela pode de fato marcar.

const DAY_MS = 24 * 60 * 60 * 1000;
// Quanto da agenda olhar à frente (as regras oferecem 10 dias; sobra margem).
const LOOKAHEAD_DAYS = 12;

export interface BookingPlan {
  // Início da reunião (ISO).
  startIso: string;
  minutes: number;
}

export function meetingRules(settings: Pick<Settings, "workStartHour" | "workEndHour" | "workWeekdaysOnly" | "meetingMinutes">): SlotRules {
  return {
    workStartHour: settings.workStartHour,
    workEndHour: settings.workEndHour,
    workWeekdaysOnly: settings.workWeekdaysOnly,
    minutes: settings.meetingMinutes,
  };
}

// Monta o que o agente enxerga a partir dos compromissos já ocupados. Separado da
// leitura do Google pra dar pra testar com uma agenda fictícia.
export function calendarContextFrom(busy: Busy[], now: Date, rules: SlotRules): CalendarContext {
  const starts = freeStarts(busy, now, rules);
  return {
    minutes: rules.minutes,
    windows: describeWindows(starts, rules),
    suggestions: suggestSlots(starts, 3).map((start) => ({ start, label: formatSlot(start), iso: slotIso(start) })),
    check: (start) => checkSlot(start, busy, now, rules),
  };
}

// Contexto de agenda para a conversa. Sem Google Agenda (ou se ele falhar agora),
// devolve null e a secretária segue como antes: proposta de horário vai pro corretor.
export async function loadCalendarContext(settings: Settings): Promise<CalendarContext | null> {
  if (!settings.googleCalendarEnabled || !(await calendarReady())) return null;
  try {
    const now = new Date();
    const busy = await listBusy(now, new Date(now.getTime() + LOOKAHEAD_DAYS * DAY_MS));
    return calendarContextFrom(busy, now, meetingRules(settings));
  } catch (err) {
    console.error("Não foi possível ler a agenda do Google", err);
    return null;
  }
}

// Marca a reunião no Google Agenda, conferindo de novo que o horário continua livre
// (a agenda pode ter mudado desde que o horário foi oferecido).
export async function bookMeeting(lead: Pick<Lead, "firstName" | "lastName" | "email" | "phone" | "linkedinProfileUrl">, plan: BookingPlan, settings: Settings): Promise<CreatedMeeting> {
  if (!(await calendarReady())) throw new Error("O Google Agenda não está conectado.");
  const start = new Date(plan.startIso);
  const busy = await listBusy(new Date(start.getTime() - DAY_MS), new Date(start.getTime() + DAY_MS));
  // Aqui a antecedência mínima não vale: o corretor pode ter aprovado em cima da hora.
  const check = checkSlot(start, busy, new Date(), { ...meetingRules(settings), minutes: plan.minutes, noticeHours: 0 });
  if (!check.ok) throw new Error(`O horário ${formatSlot(start)} não está mais livre (${check.reason}). Combine outro com a pessoa.`);

  const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "contato";
  const details = [
    "Marcada pela secretária a partir da conversa com o lead.",
    lead.phone ? `WhatsApp: ${lead.phone}` : null,
    lead.email ? `E-mail: ${lead.email}` : null,
    lead.linkedinProfileUrl ? `LinkedIn: ${lead.linkedinProfileUrl}` : null,
  ].filter(Boolean);
  return createMeeting({ startIso: slotIso(start), minutes: plan.minutes, title: `Reunião com ${name}`, description: details.join("\n"), attendeeEmail: lead.email });
}
