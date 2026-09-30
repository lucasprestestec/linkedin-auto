import { prisma } from "@/lib/prisma";
import { calendarReady, listEvents } from "@/lib/gcalendar";
import { meetingRules } from "@/lib/scheduling";
import { dayKeyOf, freeStarts, nextDays, timeLabel, windowsByDay } from "@/lib/slots";

// O que a tela "Agenda" mostra: por dia, os compromissos da agenda principal do Google
// (com o que a secretária marcou em destaque) e os horários livres que ela pode oferecer.

const DAYS = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface AgendaEvent {
  id: string;
  title: string;
  // "15:00-15:30" ou "Dia inteiro".
  time: string;
  // Ocupa o corretor (falso = marcado como "livre" no Google).
  busy: boolean;
  meetLink: string | null;
  htmlLink: string | null;
  // Reunião marcada pela secretária: a conversa com o lead.
  lead: { id: string; name: string } | null;
}

export interface AgendaDay {
  key: string;
  label: string;
  isToday: boolean;
  // Fora do expediente (fim de semana, quando o corretor só atende em dias úteis).
  offDay: boolean;
  events: AgendaEvent[];
  // "08:00-10:00": onde cabe uma reunião.
  free: string[];
}

export interface AgendaData {
  // Google conectado e com a permissão da agenda.
  connected: boolean;
  googleEmail: string | null;
  // Google conectado, mas sem a permissão da agenda (precisa reconectar).
  needsReconnect: boolean;
  configured: boolean;
  error?: string;
  days: AgendaDay[];
  minutes: number;
  workHours: string;
  // Reuniões marcadas pela secretária que ainda vão acontecer.
  secretaryMeetings: number;
}

export async function loadAgenda(googleConfigured: boolean): Promise<AgendaData> {
  const settings = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } });
  const base: AgendaData = {
    connected: false,
    googleEmail: settings.googleEmail,
    needsReconnect: Boolean(settings.googleEmail && settings.googleRefreshToken && !settings.googleCalendarEnabled),
    configured: googleConfigured,
    days: [],
    minutes: settings.meetingMinutes,
    workHours: `${settings.workStartHour}h às ${settings.workEndHour}h${settings.workWeekdaysOnly ? ", dias úteis" : ""}`,
    secretaryMeetings: 0,
  };
  if (!(await calendarReady())) return base;

  const now = new Date();
  const days = nextDays(now, DAYS);
  const from = new Date(`${days[0].key}T00:00:00-03:00`);
  const to = new Date(new Date(`${days[days.length - 1].key}T00:00:00-03:00`).getTime() + DAY_MS);

  try {
    const [events, leads] = await Promise.all([
      listEvents(from, to),
      prisma.lead.findMany({ where: { googleEventId: { not: null } }, select: { id: true, firstName: true, lastName: true, googleEventId: true } }),
    ]);
    const leadByEvent = new Map(leads.map((l) => [l.googleEventId!, { id: l.id, name: [l.firstName, l.lastName].filter(Boolean).join(" ") || "Lead" }]));

    const rules = meetingRules(settings);
    const free = new Map(
      windowsByDay(
        freeStarts(events.filter((e) => e.busy).map((e) => ({ start: e.start, end: e.end })), now, rules),
        rules,
      ).map((d) => [d.key, d.windows]),
    );

    const todayKey = days[0].key;
    let secretaryMeetings = 0;
    const out: AgendaDay[] = days.map((d) => {
      const dayEvents = events
        .filter((e) => dayKeyOf(e.start) === d.key)
        .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.getTime() - b.start.getTime())
        .map((e): AgendaEvent => {
          const lead = leadByEvent.get(e.id) ?? null;
          if (lead && e.end.getTime() > now.getTime()) secretaryMeetings++;
          return {
            id: e.id,
            title: e.title,
            time: e.allDay ? "Dia inteiro" : `${timeLabel(e.start)}-${timeLabel(e.end)}`,
            busy: e.busy,
            meetLink: e.meetLink,
            htmlLink: e.htmlLink,
            lead,
          };
        });
      return {
        key: d.key,
        label: d.label,
        isToday: d.key === todayKey,
        offDay: settings.workWeekdaysOnly && (d.weekday === 0 || d.weekday === 6),
        events: dayEvents,
        free: free.get(d.key) ?? [],
      };
    });
    return { ...base, connected: true, days: out, secretaryMeetings };
  } catch (err) {
    return { ...base, connected: true, error: err instanceof Error ? err.message : "Não foi possível ler a agenda." };
  }
}
