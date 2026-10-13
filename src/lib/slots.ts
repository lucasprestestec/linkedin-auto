// Horários livres para reunião. Só regra de negócio (sem Google): recebe os
// compromissos já ocupados e devolve o que dá pra oferecer. Tudo no horário de
// Brasília (UTC-3 fixo: o Brasil não tem horário de verão desde 2019, e o resto
// do sistema já assume isso).

const OFFSET_MS = 3 * 60 * 60 * 1000;
const MIN_MS = 60 * 1000;
const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"] as const;

export interface Busy {
  start: Date;
  end: Date;
}

export interface SlotRules {
  workStartHour: number;
  workEndHour: number;
  workWeekdaysOnly: boolean;
  // Duração da reunião.
  minutes: number;
  // Não oferece nada nas próximas horas (o corretor precisa poder se preparar).
  noticeHours?: number;
  // Até quantos dias à frente.
  horizonDays?: number;
  // Folga antes e depois de outro compromisso.
  bufferMinutes?: number;
  // Os horários começam em múltiplos disto (30 = hora cheia e meia hora).
  stepMinutes?: number;
}

const DEFAULTS = { noticeHours: 4, horizonDays: 10, bufferMinutes: 10, stepMinutes: 30 };

interface Local {
  y: number;
  m: number; // 0-11
  d: number;
  h: number;
  min: number;
  weekday: number;
}

function local(date: Date): Local {
  const t = new Date(date.getTime() - OFFSET_MS);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate(), h: t.getUTCHours(), min: t.getUTCMinutes(), weekday: t.getUTCDay() };
}

function fromLocal(y: number, m: number, d: number, h = 0, min = 0): Date {
  return new Date(Date.UTC(y, m, d, h, min) + OFFSET_MS);
}

function dayKey(l: Local): string {
  return `${l.y}-${String(l.m + 1).padStart(2, "0")}-${String(l.d).padStart(2, "0")}`;
}

function conflicts(start: Date, end: Date, busy: Busy[], bufferMs: number): boolean {
  return busy.some((b) => b.start.getTime() < end.getTime() + bufferMs && b.end.getTime() > start.getTime() - bufferMs);
}

// Todos os inícios possíveis, em ordem.
export function freeStarts(busy: Busy[], now: Date, rules: SlotRules): Date[] {
  const { noticeHours, horizonDays, bufferMinutes, stepMinutes } = { ...DEFAULTS, ...stripUndefined(rules) };
  const earliest = now.getTime() + noticeHours * 60 * MIN_MS;
  const bufferMs = bufferMinutes * MIN_MS;
  const today = local(now);
  const out: Date[] = [];
  for (let i = 0; i <= horizonDays; i++) {
    const day = fromLocal(today.y, today.m, today.d + i);
    const l = local(new Date(day.getTime() + 12 * 60 * MIN_MS));
    if (rules.workWeekdaysOnly && (l.weekday === 0 || l.weekday === 6)) continue;
    for (let minute = rules.workStartHour * 60; minute + rules.minutes <= rules.workEndHour * 60; minute += stepMinutes) {
      const start = fromLocal(l.y, l.m, l.d, Math.floor(minute / 60), minute % 60);
      if (start.getTime() < earliest) continue;
      const end = new Date(start.getTime() + rules.minutes * MIN_MS);
      if (!conflicts(start, end, busy, bufferMs)) out.push(start);
    }
  }
  return out;
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

// Um horário qualquer (que o lead pediu, ou que o modelo escolheu) está livre e
// dentro das regras? Usado antes de oferecer e de novo na hora de marcar.
export function checkSlot(start: Date, busy: Busy[], now: Date, rules: SlotRules): { ok: true } | { ok: false; reason: string } {
  const r = { ...DEFAULTS, ...stripUndefined(rules) };
  if (Number.isNaN(start.getTime())) return { ok: false, reason: "horário inválido" };
  const l = local(start);
  if (rules.workWeekdaysOnly && (l.weekday === 0 || l.weekday === 6)) return { ok: false, reason: "fim de semana" };
  const minuteOfDay = l.h * 60 + l.min;
  if (minuteOfDay < rules.workStartHour * 60 || minuteOfDay + rules.minutes > rules.workEndHour * 60) return { ok: false, reason: "fora do horário de atendimento" };
  if (l.min % r.stepMinutes !== 0) return { ok: false, reason: `use horário cheio ou meia hora (múltiplo de ${r.stepMinutes} minutos)` };
  if (start.getTime() < now.getTime() + r.noticeHours * 60 * MIN_MS) return { ok: false, reason: "muito em cima da hora" };
  if (start.getTime() > now.getTime() + (r.horizonDays + 1) * 24 * 60 * MIN_MS) return { ok: false, reason: "longe demais" };
  const end = new Date(start.getTime() + rules.minutes * MIN_MS);
  if (conflicts(start, end, busy, r.bufferMinutes * MIN_MS)) return { ok: false, reason: "horário ocupado na agenda" };
  return { ok: true };
}

const pad = (n: number) => String(n).padStart(2, "0");

// "quinta, 02/10 às 15h" / "sexta, 03/10 às 9h30"
export function formatSlot(start: Date): string {
  const l = local(start);
  const hour = l.min === 0 ? `${l.h}h` : `${l.h}h${pad(l.min)}`;
  return `${WEEKDAYS[l.weekday]}, ${pad(l.d)}/${pad(l.m + 1)} às ${hour}`;
}

export function slotIso(start: Date): string {
  const l = local(start);
  return `${dayKey(l)}T${pad(l.h)}:${pad(l.min)}:00-03:00`;
}

export interface DayWindows {
  // "2026-10-01" (dia em Brasília).
  key: string;
  // "quinta, 01/10"
  label: string;
  // "08:00-10:00", "14:00-19:00": onde cabe uma reunião.
  windows: string[];
  // As mesmas janelas em minutos desde a meia-noite (pra desenhar na grade da semana).
  ranges: { startMin: number; endMin: number }[];
}

// Minutos desde a meia-noite, em Brasília.
export function minutesOfDay(date: Date): number {
  const l = local(date);
  return l.h * 60 + l.min;
}

// Janelas livres separadas por dia. A janela vai do primeiro início ao fim da última
// reunião que cabe.
export function windowsByDay(starts: Date[], rules: Pick<SlotRules, "minutes" | "stepMinutes">): DayWindows[] {
  const step = rules.stepMinutes ?? DEFAULTS.stepMinutes;
  const byDay = new Map<string, Date[]>();
  for (const s of starts) {
    const k = dayKey(local(s));
    byDay.set(k, [...(byDay.get(k) ?? []), s]);
  }
  const out: DayWindows[] = [];
  for (const [k, list] of byDay) {
    const l = local(list[0]);
    const windows: string[] = [];
    const ranges: { startMin: number; endMin: number }[] = [];
    let from = list[0];
    let prev = list[0];
    const close = () => {
      const end = new Date(prev.getTime() + rules.minutes * MIN_MS);
      const a = local(from);
      const b = local(end);
      windows.push(`${pad(a.h)}:${pad(a.min)}-${pad(b.h)}:${pad(b.min)}`);
      ranges.push({ startMin: a.h * 60 + a.min, endMin: b.h * 60 + b.min });
    };
    for (const s of list.slice(1)) {
      if (s.getTime() - prev.getTime() !== step * MIN_MS) {
        close();
        from = s;
      }
      prev = s;
    }
    close();
    out.push({ key: k, label: `${WEEKDAYS[l.weekday]}, ${pad(l.d)}/${pad(l.m + 1)}`, windows, ranges });
  }
  return out;
}

// Janelas livres por dia, em texto curto pro modelo ("qui 02/10: 09:00-12:00, 14:00-17:30").
export function describeWindows(starts: Date[], rules: Pick<SlotRules, "minutes" | "stepMinutes">): string[] {
  return windowsByDay(starts, rules).map((d) => {
    const [weekday, date] = d.label.split(", ");
    return `${weekday} ${date}: ${d.windows.join(", ")}`;
  });
}

// ---- Para mostrar na tela (tudo em horário de Brasília) ----

// "2026-10-01": o dia em que o instante cai em Brasília.
export function dayKeyOf(date: Date): string {
  return dayKey(local(date));
}

// Os próximos `days` dias a partir de hoje, com o texto de cada um ("quinta, 01/10").
export function nextDays(now: Date, days: number): { key: string; label: string; weekday: number }[] {
  const today = local(now);
  const out: { key: string; label: string; weekday: number }[] = [];
  for (let i = 0; i < days; i++) {
    const noon = new Date(fromLocal(today.y, today.m, today.d + i).getTime() + 12 * 60 * MIN_MS);
    const l = local(noon);
    out.push({ key: dayKey(l), label: `${WEEKDAYS[l.weekday]}, ${pad(l.d)}/${pad(l.m + 1)}`, weekday: l.weekday });
  }
  return out;
}

// "15:00" (hora em Brasília).
export function timeLabel(date: Date): string {
  const l = local(date);
  return `${pad(l.h)}:${pad(l.min)}`;
}

// Até `n` sugestões em dias diferentes, alternando manhã e tarde: o lead escolhe
// entre poucas opções em vez de receber uma lista.
export function suggestSlots(starts: Date[], n = 3): Date[] {
  const byDay = new Map<string, Date[]>();
  for (const s of starts) {
    const k = dayKey(local(s));
    byDay.set(k, [...(byDay.get(k) ?? []), s]);
  }
  const picks: Date[] = [];
  let i = 0;
  for (const list of byDay.values()) {
    if (picks.length >= n) break;
    const target = (i % 2 === 0 ? 10 : 15) * 60;
    const best = list.reduce((a, b) => {
      const da = Math.abs(local(a).h * 60 + local(a).min - target);
      const db = Math.abs(local(b).h * 60 + local(b).min - target);
      return db < da ? b : a;
    });
    picks.push(best);
    i++;
  }
  return picks;
}

// Confere o TEXTO da mensagem contra os horários que ela pode citar: todo horário
// (15h, 15h30, 15:30), dia da semana, "amanhã"/"hoje" e data (02/10) escritos
// precisam bater com um dos permitidos. Sem horários permitidos, nada disso pode
// aparecer. É o que impede o modelo de prometer um horário que ele inventou.
export function checkTimesMentioned(message: string, allowed: Date[], now: Date = new Date()): string[] {
  const issues: string[] = [];
  const parts = allowed.map(local);
  const allowedTimes = new Set(parts.map((l) => `${l.h}:${pad(l.min)}`));
  const allowedWeekdays = new Set(parts.map((l) => WEEKDAYS[l.weekday]));
  const allowedDates = new Set(parts.map((l) => `${l.d}/${l.m + 1}`));
  const tomorrow = local(new Date(now.getTime() + 24 * 60 * MIN_MS));
  const text = message.toLowerCase();

  for (const m of text.matchAll(/(?<![\d/])(\d{1,2})(?:\s?h(?:oras?)?(\d{2})?|:(\d{2}))(?![\d])/g)) {
    const minutes = m[2] ?? m[3] ?? "00";
    if (!allowedTimes.has(`${Number(m[1])}:${minutes}`)) {
      issues.push(`cita o horário "${m[0].trim()}", que não é um dos horários livres oferecidos`);
      break;
    }
  }
  // "segunda" sozinha costuma ser ordinal ("segunda opção"): só vale como dia com "-feira"
  // ou depois de "na/dia/pra/para...".
  const weekdayWords = /(?:(?:^|[\s,.;])(?:na|nesta|esta|próxima|proxima|dia|de|pra|para|até|ate|toda)\s+)?\b(segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)(-feira)?\b/g;
  for (const m of text.matchAll(weekdayWords)) {
    if (m[1] === "segunda" && !m[2] && !/(?:na|nesta|esta|próxima|proxima|dia|de|pra|para|até|ate|toda)\s+segunda\b/.test(m[0])) continue;
    const name = m[1] === "terca" ? "terça" : m[1] === "sabado" ? "sábado" : m[1];
    if (!allowedWeekdays.has(name as (typeof WEEKDAYS)[number])) {
      issues.push(`cita "${m[0]}", que não é um dos dias livres oferecidos`);
      break;
    }
  }
  for (const m of text.matchAll(/(?<![\d/])(\d{1,2})\/(\d{1,2})(?![\d/])/g)) {
    if (!allowedDates.has(`${Number(m[1])}/${Number(m[2])}`)) {
      issues.push(`cita a data ${m[0]}, que não é uma das datas livres oferecidas`);
      break;
    }
  }
  if (/\bamanhã\b|\bamanha\b/.test(text) && !parts.some((l) => l.d === tomorrow.d && l.m === tomorrow.m)) issues.push('cita "amanhã", mas não oferece nenhum horário de amanhã');
  // "hoje" fica de fora de propósito: aparece em frases normais ("hoje vocês já têm plano?").
  return issues;
}
