// Datas como texto "AAAA-MM-DD" (o dia no calendário, sem fuso). Toda a conta é feita em
// UTC só para somar dias/meses sem surpresas; quem converte instantes em Brasília é o slots.ts.

export const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"] as const;
export const WEEKDAYS_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;
export const WEEKDAYS_LONG = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"] as const;

const pad = (n: number) => String(n).padStart(2, "0");

export function isValidKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function toDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromDate(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function addDays(key: string, n: number): string {
  const d = toDate(key);
  d.setUTCDate(d.getUTCDate() + n);
  return fromDate(d);
}

// Primeiro dia do mês, `n` meses adiante (ou atrás).
export function addMonths(key: string, n: number): string {
  const d = toDate(key);
  return fromDate(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1)));
}

export function weekdayOf(key: string): number {
  return toDate(key).getUTCDay();
}

export function dayOfMonth(key: string): number {
  return toDate(key).getUTCDate();
}

export function monthOf(key: string): number {
  return toDate(key).getUTCMonth();
}

// "outubro de 2026"
export function monthTitle(key: string): string {
  const d = toDate(key);
  return `${capitalize(MONTHS[d.getUTCMonth()])} de ${d.getUTCFullYear()}`;
}

// Domingo a sábado da semana que contém `key`.
export function weekKeys(key: string): string[] {
  const start = addDays(key, -weekdayOf(key));
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

// As 6 semanas (42 dias, domingo a sábado) que cobrem o mês de `key`.
export function monthGrid(key: string): string[] {
  const first = addMonths(key, 0);
  const start = addDays(first, -weekdayOf(first));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

// "27 set – 03 out 2026" / "28 set – 04 out 2026"
export function weekTitle(keys: string[]): string {
  const a = toDate(keys[0]);
  const b = toDate(keys[6]);
  const mon = (d: Date) => MONTHS[d.getUTCMonth()].slice(0, 3);
  const left = `${pad(a.getUTCDate())} ${mon(a)}`;
  const right = `${pad(b.getUTCDate())} ${mon(b)} ${b.getUTCFullYear()}`;
  return `${left} – ${right}`;
}

// "quinta-feira, 01 de outubro"
export function longDayLabel(key: string): string {
  const d = toDate(key);
  return `${capitalize(WEEKDAYS_LONG[d.getUTCDay()])}, ${pad(d.getUTCDate())} de ${MONTHS[d.getUTCMonth()]}`;
}

// Primeira letra maiúscula, só ela ("setembro de 2026" -> "Setembro de 2026").
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
