import { prisma } from "@/lib/prisma";
import { calendarReady, listEvents, type CalendarEvent } from "@/lib/gcalendar";
import { addDays, addMonths, dayOfMonth, isValidKey, monthGrid, monthOf, monthTitle, weekKeys, weekTitle, weekdayOf } from "@/lib/dateKeys";
import { dayKeyOf, freeStarts, minutesOfDay, nextDays, timeLabel, windowsByDay, type SlotRules } from "@/lib/slots";

// O que a tela "Agenda" mostra: um calendário (mês ou semana) com os compromissos da
// agenda principal do Google, o que a secretária marcou em destaque e os horários livres
// que ela pode oferecer.

export type AgendaViewMode = "mes" | "semana";

export interface AgendaEvent {
  id: string;
  title: string;
  allDay: boolean;
  // Minutos desde a meia-noite (Brasília), para posicionar na grade da semana.
  startMin: number;
  endMin: number;
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
  dayNumber: number;
  weekday: number;
  // Pertence ao mês em foco (na visão de mês, os dias das pontas ficam esmaecidos).
  inMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  // Fora do expediente (fim de semana, quando o corretor só atende em dias úteis).
  offDay: boolean;
  // A secretária oferece horários neste dia (hoje até os próximos dias, conforme as regras).
  offerable: boolean;
  events: AgendaEvent[];
  free: { startMin: number; endMin: number }[];
  freeLabels: string[];
}

export interface AgendaData {
  // Google conectado e com a permissão da agenda.
  connected: boolean;
  googleEmail: string | null;
  // Google conectado, mas sem a permissão da agenda (precisa reconectar).
  needsReconnect: boolean;
  configured: boolean;
  error?: string;
  view: AgendaViewMode;
  focusKey: string;
  todayKey: string;
  title: string;
  prevKey: string;
  nextKey: string;
  days: AgendaDay[];
  // Dia selecionado (visão de mês): o painel de detalhes.
  selected: AgendaDay | null;
  minutes: number;
  workHours: string;
  workStartHour: number;
  workEndHour: number;
  // Reuniões marcadas (pela secretária ou à mão) que ainda vão acontecer.
  upcomingMeetings: number;
}

export interface SettingsForAgenda {
  workStartHour: number;
  workEndHour: number;
  workWeekdaysOnly: boolean;
  meetingMinutes: number;
}

// Os dias que a tela mostra para cada visão (mês = 6 semanas cheias; semana = dom a sáb).
export function visibleKeys(view: AgendaViewMode, focusKey: string): string[] {
  return view === "semana" ? weekKeys(focusKey) : monthGrid(focusKey);
}

export interface BuildInput {
  events: CalendarEvent[];
  leads: { id: string; name: string; googleEventId: string }[];
  settings: SettingsForAgenda;
  now: Date;
  view: AgendaViewMode;
  focusKey: string;
}

export function buildAgenda({ events, leads, settings, now, view, focusKey }: BuildInput) {
  const keys = visibleKeys(view, focusKey);
  const todayKey = dayKeyOf(now);
  const leadByEvent = new Map(leads.map((l) => [l.googleEventId, { id: l.id, name: l.name }]));

  const rules: SlotRules = {
    workStartHour: settings.workStartHour,
    workEndHour: settings.workEndHour,
    workWeekdaysOnly: settings.workWeekdaysOnly,
    minutes: settings.meetingMinutes,
  };
  const free = new Map(
    windowsByDay(
      freeStarts(events.filter((e) => e.busy).map((e) => ({ start: e.start, end: e.end })), now, rules),
      rules,
    ).map((d) => [d.key, d]),
  );
  const offerableKeys = new Set(nextDays(now, 11).map((d) => d.key));

  // Evento de dia inteiro aparece em todos os dias que cobre; os demais, no dia em que começam.
  const byDay = new Map<string, AgendaEvent[]>();
  for (const e of events) {
    const first = dayKeyOf(e.start);
    const last = e.allDay ? dayKeyOf(new Date(e.end.getTime() - 1)) : first;
    const event: AgendaEvent = {
      id: e.id,
      title: e.title,
      allDay: e.allDay,
      startMin: e.allDay ? 0 : minutesOfDay(e.start),
      endMin: e.allDay ? 24 * 60 : Math.min(24 * 60, dayKeyOf(e.end) === first ? minutesOfDay(e.end) : 24 * 60),
      time: e.allDay ? "Dia inteiro" : `${timeLabel(e.start)}-${timeLabel(e.end)}`,
      busy: e.busy,
      meetLink: e.meetLink,
      htmlLink: e.htmlLink,
      lead: leadByEvent.get(e.id) ?? null,
    };
    for (let k = first; k <= last && k <= keys[keys.length - 1]; k = addDays(k, 1)) {
      if (k >= keys[0]) byDay.set(k, [...(byDay.get(k) ?? []), event]);
    }
  }

  const focusMonth = monthOf(focusKey);
  const days: AgendaDay[] = keys.map((key) => {
    const w = weekdayOf(key);
    const f = free.get(key);
    const dayEvents = (byDay.get(key) ?? []).sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.startMin - b.startMin);
    return {
      key,
      dayNumber: dayOfMonth(key),
      weekday: w,
      inMonth: view === "semana" || monthOf(key) === focusMonth,
      isToday: key === todayKey,
      isPast: key < todayKey,
      offDay: settings.workWeekdaysOnly && (w === 0 || w === 6),
      offerable: offerableKeys.has(key),
      events: dayEvents,
      free: f?.ranges ?? [],
      freeLabels: f?.windows ?? [],
    };
  });

  return {
    view,
    focusKey,
    todayKey,
    title: view === "semana" ? weekTitle(keys) : monthTitle(focusKey),
    prevKey: view === "semana" ? addDays(focusKey, -7) : addMonths(focusKey, -1),
    nextKey: view === "semana" ? addDays(focusKey, 7) : addMonths(focusKey, 1),
    days,
    selected: days.find((d) => d.key === focusKey) ?? null,
    minutes: settings.meetingMinutes,
    workHours: `${settings.workStartHour}h às ${settings.workEndHour}h${settings.workWeekdaysOnly ? ", dias úteis" : ""}`,
    workStartHour: settings.workStartHour,
    workEndHour: settings.workEndHour,
  };
}

export function parseView(value: unknown): AgendaViewMode {
  return value === "semana" ? "semana" : "mes";
}

// Data em foco vinda da URL; se faltar ou for inválida, hoje.
export function parseFocus(value: unknown, todayKey: string): string {
  return isValidKey(value) ? value : todayKey;
}

export async function loadAgenda(googleConfigured: boolean, view: AgendaViewMode, focusParam: unknown): Promise<AgendaData> {
  const settings = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } });
  const now = new Date();
  const focusKey = parseFocus(focusParam, dayKeyOf(now));
  const keys = visibleKeys(view, focusKey);

  const empty = {
    ...buildAgenda({ events: [], leads: [], settings, now, view, focusKey }),
    days: [] as AgendaDay[],
    selected: null,
  };
  const base: AgendaData = {
    ...empty,
    connected: false,
    googleEmail: settings.googleEmail,
    needsReconnect: Boolean(settings.googleEmail && settings.googleRefreshToken && !settings.googleCalendarEnabled),
    configured: googleConfigured,
    upcomingMeetings: 0,
  };
  if (!(await calendarReady())) return base;

  try {
    const from = new Date(`${keys[0]}T00:00:00-03:00`);
    const to = new Date(new Date(`${keys[keys.length - 1]}T00:00:00-03:00`).getTime() + 24 * 60 * 60 * 1000);
    const [events, leads, upcomingMeetings] = await Promise.all([
      listEvents(from, to),
      prisma.lead.findMany({ where: { googleEventId: { not: null } }, select: { id: true, firstName: true, lastName: true, googleEventId: true } }),
      prisma.lead.count({ where: { meetingAt: { gte: now } } }),
    ]);
    const built = buildAgenda({
      events,
      leads: leads.map((l) => ({ id: l.id, name: [l.firstName, l.lastName].filter(Boolean).join(" ") || "Lead", googleEventId: l.googleEventId! })),
      settings,
      now,
      view,
      focusKey,
    });
    return { ...base, ...built, connected: true, upcomingMeetings };
  } catch (err) {
    return { ...base, connected: true, error: err instanceof Error ? err.message : "Não foi possível ler a agenda." };
  }
}
