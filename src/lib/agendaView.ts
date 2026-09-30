import { prisma } from "@/lib/prisma";
import { calendarReady, listEvents } from "@/lib/gcalendar";
import { loadWindow, parseFocus, type AgendaViewMode, type SettingsForAgenda } from "@/lib/agendaBuild";
import { dayKeyOf } from "@/lib/slots";

// Lado do servidor da tela "Agenda": lê o Google UMA vez para uma janela larga (o mês em
// foco e os vizinhos) e entrega os compromissos crus. O navegador monta mês, semana e dia
// a partir disso, então trocar de dia ou de mês dentro da janela não volta ao servidor.

// Um compromisso como viaja do servidor ao navegador (datas em texto ISO).
export interface RawAgendaEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  busy: boolean;
  meetLink: string | null;
  htmlLink: string | null;
}

export interface AgendaPayload {
  // Google conectado e com a permissão da agenda.
  connected: boolean;
  googleEmail: string | null;
  // Google conectado, mas sem a permissão da agenda (precisa reconectar).
  needsReconnect: boolean;
  configured: boolean;
  error?: string;
  view: AgendaViewMode;
  // A visão veio escolhida na URL (senão, no celular a tela abre em "Dia").
  viewExplicit: boolean;
  focusKey: string;
  // Janela lida do Google (dias AAAA-MM-DD, inclusive).
  fromKey: string;
  toKey: string;
  // O "agora" do servidor: horários livres e o dia de hoje partem dele.
  nowIso: string;
  events: RawAgendaEvent[];
  leads: { id: string; name: string; googleEventId: string }[];
  settings: SettingsForAgenda;
  // Reuniões marcadas (pela secretária ou à mão) que ainda vão acontecer.
  upcomingMeetings: number;
}

export async function loadAgenda(googleConfigured: boolean, view: AgendaViewMode, focusParam: unknown, viewExplicit: boolean): Promise<AgendaPayload> {
  const settings = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } });
  const now = new Date();
  const focusKey = parseFocus(focusParam, dayKeyOf(now));
  const { fromKey, toKey } = loadWindow(focusKey);

  const base: AgendaPayload = {
    connected: false,
    googleEmail: settings.googleEmail,
    needsReconnect: Boolean(settings.googleEmail && settings.googleRefreshToken && !settings.googleCalendarEnabled),
    configured: googleConfigured,
    view,
    viewExplicit,
    focusKey,
    fromKey,
    toKey,
    nowIso: now.toISOString(),
    events: [],
    leads: [],
    settings: {
      workStartHour: settings.workStartHour,
      workEndHour: settings.workEndHour,
      workWeekdaysOnly: settings.workWeekdaysOnly,
      meetingMinutes: settings.meetingMinutes,
    },
    upcomingMeetings: 0,
  };
  if (!(await calendarReady())) return base;

  try {
    const from = new Date(`${fromKey}T00:00:00-03:00`);
    const to = new Date(new Date(`${toKey}T00:00:00-03:00`).getTime() + 24 * 60 * 60 * 1000);
    const [events, leads, upcomingMeetings] = await Promise.all([
      listEvents(from, to),
      prisma.lead.findMany({ where: { googleEventId: { not: null } }, select: { id: true, firstName: true, lastName: true, googleEventId: true } }),
      prisma.lead.count({ where: { meetingAt: { gte: now } } }),
    ]);
    return {
      ...base,
      connected: true,
      events: events.map((e) => ({
        id: e.id,
        title: e.title,
        start: e.start.toISOString(),
        end: e.end.toISOString(),
        allDay: e.allDay,
        busy: e.busy,
        meetLink: e.meetLink,
        htmlLink: e.htmlLink,
      })),
      leads: leads.map((l) => ({ id: l.id, name: [l.firstName, l.lastName].filter(Boolean).join(" ") || "Lead", googleEventId: l.googleEventId! })),
      upcomingMeetings,
    };
  } catch (err) {
    return { ...base, connected: true, error: err instanceof Error ? err.message : "Não foi possível ler a agenda." };
  }
}
