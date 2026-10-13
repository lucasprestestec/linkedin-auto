import { addDays, addMonths, dayOfMonth, isValidKey, longDayLabel, monthGrid, monthOf, monthTitle, weekKeys, weekTitle, weekdayOf } from "@/lib/dateKeys";
import { dayKeyOf, freeStarts, minutesOfDay, nextDays, timeLabel, windowsByDay, type SlotRules } from "@/lib/slots";

// Monta o calendário (mês ou semana) a partir dos compromissos já lidos. Só conta e
// data, sem Google nem banco: roda no navegador (a tela troca de dia e de mês sem
// voltar ao servidor) e nos testes.

// "dia" e "semana" são a grade de horários (o que se abre por padrão); "mes" é o panorama.
export type AgendaViewMode = "dia" | "semana" | "mes";

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

export interface AgendaSourceEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  busy: boolean;
  meetLink: string | null;
  htmlLink: string | null;
}

export interface SettingsForAgenda {
  workStartHour: number;
  workEndHour: number;
  workWeekdaysOnly: boolean;
  meetingMinutes: number;
}

// Os dias que a tela mostra para cada visão (mês = 6 semanas cheias; semana = dom a sáb).
export function visibleKeys(view: AgendaViewMode, focusKey: string): string[] {
  if (view === "dia") return [focusKey];
  return view === "semana" ? weekKeys(focusKey) : monthGrid(focusKey);
}

// O que se carrega de uma vez: o mês em foco e os vizinhos. Trocar de dia, de semana ou
// de mês dentro dessa janela é instantâneo; só sair dela busca de novo no Google.
export function loadWindow(focusKey: string): { fromKey: string; toKey: string } {
  const before = monthGrid(addMonths(focusKey, -1));
  const after = monthGrid(addMonths(focusKey, 1));
  return { fromKey: before[0], toKey: after[after.length - 1] };
}

export function insideWindow(keys: string[], w: { fromKey: string; toKey: string }): boolean {
  return keys[0] >= w.fromKey && keys[keys.length - 1] <= w.toKey;
}

export interface BuildInput {
  events: AgendaSourceEvent[];
  leads: { id: string; name: string; googleEventId: string }[];
  settings: SettingsForAgenda;
  now: Date;
  view: AgendaViewMode;
  focusKey: string;
}

export interface BuiltAgenda {
  view: AgendaViewMode;
  focusKey: string;
  todayKey: string;
  title: string;
  prevKey: string;
  nextKey: string;
  days: AgendaDay[];
  // Dia em foco (o painel de detalhes).
  selected: AgendaDay | null;
  minutes: number;
  workHours: string;
  workStartHour: number;
  workEndHour: number;
}

export function buildAgenda({ events, leads, settings, now, view, focusKey }: BuildInput): BuiltAgenda {
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
    title: view === "dia" ? longDayLabel(focusKey) : view === "semana" ? weekTitle(keys) : monthTitle(focusKey),
    prevKey: view === "dia" ? addDays(focusKey, -1) : view === "semana" ? addDays(focusKey, -7) : addMonths(focusKey, -1),
    nextKey: view === "dia" ? addDays(focusKey, 1) : view === "semana" ? addDays(focusKey, 7) : addMonths(focusKey, 1),
    days,
    selected: days.find((d) => d.key === focusKey) ?? null,
    minutes: settings.meetingMinutes,
    workHours: `${settings.workStartHour}h às ${settings.workEndHour}h${settings.workWeekdaysOnly ? ", dias úteis" : ""}`,
    workStartHour: settings.workStartHour,
    workEndHour: settings.workEndHour,
  };
}

// Sem escolha na URL, abre a semana (a grade de horários).
export function parseView(value: unknown): AgendaViewMode {
  return value === "dia" || value === "mes" ? value : "semana";
}

// Data em foco vinda da URL; se faltar ou for inválida, hoje.
export function parseFocus(value: unknown, todayKey: string): string {
  return isValidKey(value) ? value : todayKey;
}
