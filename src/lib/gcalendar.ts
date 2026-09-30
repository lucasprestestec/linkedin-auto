import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { googleAccessToken } from "@/lib/gmail";
import type { Busy } from "@/lib/slots";

// Google Agenda (agenda principal do corretor): ler o que está ocupado e criar a
// reunião com link do Meet. Usa a mesma conexão do Gmail ("Entrar com Google"),
// com o escopo calendar.events — sem servidor extra e sem custo.

const API = "https://www.googleapis.com/calendar/v3/calendars/primary";
const TIME_ZONE = "America/Sao_Paulo";

export class CalendarError extends Error {}

// Conectado e com a permissão da agenda liberada pelo corretor.
export async function calendarReady(): Promise<boolean> {
  const s = await prisma.settings.findUnique({ where: { id: "singleton" }, select: { googleCalendarEnabled: true, googleRefreshToken: true } });
  return Boolean(s?.googleCalendarEnabled && s.googleRefreshToken);
}

async function calendarFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${await googleAccessToken()}`, "content-type": "application/json", ...init?.headers },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
  if (!res.ok) {
    const message = body.error?.message ?? `Google Agenda respondeu ${res.status}`;
    if (res.status === 401 || res.status === 403) {
      throw new CalendarError("O Google não liberou a agenda. Reconecte o Google em Canais e aceite a permissão da agenda.");
    }
    const err = new CalendarError(message) as CalendarError & { status?: number };
    err.status = res.status;
    throw err;
  }
  return body as T;
}

interface GEvent {
  id?: string;
  status?: string;
  summary?: string;
  transparency?: string;
  eventType?: string;
  hangoutLink?: string;
  htmlLink?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: { self?: boolean; responseStatus?: string }[];
}

// Um compromisso da agenda, já no formato que o sistema usa.
export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  // Evento de dia inteiro (sem hora marcada).
  allDay: boolean;
  // Ocupa o corretor? Falso para o que está marcado como "livre" no Google.
  busy: boolean;
  meetLink: string | null;
  htmlLink: string | null;
}

// Compromissos entre `from` e `to`, em ordem. Ficam de fora os cancelados e os que o
// próprio corretor recusou.
export async function listEvents(from: Date, to: Date): Promise<CalendarEvent[]> {
  const events: CalendarEvent[] = [];
  let pageToken: string | undefined;
  do {
    const q = new URLSearchParams({
      timeMin: from.toISOString(),
      timeMax: to.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
      ...(pageToken ? { pageToken } : {}),
    });
    const page = await calendarFetch<{ items?: GEvent[]; nextPageToken?: string }>(`/events?${q}`);
    for (const e of page.items ?? []) {
      if (e.status === "cancelled") continue;
      // "Casa/Escritório" do Google é uma faixa no calendário deles, não um compromisso.
      if (e.eventType === "workingLocation") continue;
      if (e.attendees?.some((a) => a.self && a.responseStatus === "declined")) continue;
      const start = e.start?.dateTime ?? (e.start?.date ? `${e.start.date}T00:00:00-03:00` : null);
      const end = e.end?.dateTime ?? (e.end?.date ? `${e.end.date}T00:00:00-03:00` : null);
      if (!start || !end) continue;
      events.push({
        id: e.id ?? `${start}-${e.summary ?? ""}`,
        title: e.summary?.trim() || "(sem título)",
        start: new Date(start),
        end: new Date(end),
        allDay: Boolean(e.start?.date && !e.start?.dateTime),
        busy: e.transparency !== "transparent",
        meetLink: e.hangoutLink ?? null,
        htmlLink: e.htmlLink ?? null,
      });
    }
    pageToken = page.nextPageToken;
  } while (pageToken);
  return events;
}

// O que ocupa o corretor entre `from` e `to` (base dos horários livres). Evento de dia
// inteiro só bloqueia se estiver como "ocupado" (o Google já marca aniversários como livre).
export async function listBusy(from: Date, to: Date): Promise<Busy[]> {
  return (await listEvents(from, to)).filter((e) => e.busy).map((e) => ({ start: e.start, end: e.end }));
}

export interface MeetingInput {
  startIso: string;
  minutes: number;
  title: string;
  description: string;
  // Convite por e-mail do próprio Google (se a pessoa tem e-mail na ficha).
  attendeeEmail?: string | null;
}

export interface CreatedMeeting {
  id: string;
  meetLink: string | null;
  htmlLink: string | null;
}

export async function createMeeting(input: MeetingInput): Promise<CreatedMeeting> {
  const start = new Date(input.startIso);
  const end = new Date(start.getTime() + input.minutes * 60 * 1000);
  const build = (withAttendee: boolean) => ({
    summary: input.title,
    description: input.description,
    start: { dateTime: start.toISOString(), timeZone: TIME_ZONE },
    end: { dateTime: end.toISOString(), timeZone: TIME_ZONE },
    ...(withAttendee && input.attendeeEmail ? { attendees: [{ email: input.attendeeEmail }] } : {}),
    // Um Meet novo por evento (reaproveitar a mesma sala em vários eventos dá problema de acesso).
    conferenceData: { createRequest: { requestId: randomUUID(), conferenceSolutionKey: { type: "hangoutsMeet" } } },
  });
  const insert = (withAttendee: boolean) =>
    calendarFetch<{ id: string; hangoutLink?: string; htmlLink?: string; conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] } }>(
      `/events?conferenceDataVersion=1&sendUpdates=${withAttendee && input.attendeeEmail ? "all" : "none"}`,
      { method: "POST", body: JSON.stringify(build(withAttendee)) },
    );

  let created;
  try {
    created = await insert(true);
  } catch (err) {
    // E-mail que o Google não aceita: marca a reunião mesmo assim, sem o convite.
    if (input.attendeeEmail && (err as { status?: number }).status === 400) created = await insert(false);
    else throw err;
  }
  const video = created.conferenceData?.entryPoints?.find((p) => p.entryPointType === "video")?.uri;
  return { id: created.id, meetLink: created.hangoutLink ?? video ?? null, htmlLink: created.htmlLink ?? null };
}

// Cancela a reunião (ex.: a mensagem de confirmação não saiu). 404/410 = já não existe.
export async function deleteMeeting(eventId: string): Promise<void> {
  try {
    await calendarFetch(`/events/${encodeURIComponent(eventId)}?sendUpdates=all`, { method: "DELETE" });
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status !== 404 && status !== 410) throw err;
  }
}
