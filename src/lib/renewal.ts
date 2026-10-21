// Renovações da carteira: leitura de datas em qualquer formato de planilha e contas de prazo.
// Sem banco e sem rede: a importação, a ficha e a tela Hoje usam as mesmas regras.

const MONTHS: Record<string, number> = {
  jan: 1, janeiro: 1, fev: 2, fevereiro: 2, mar: 3, marco: 3, abr: 4, abril: 4, mai: 5, maio: 5, jun: 6, junho: 6,
  jul: 7, julho: 7, ago: 8, agosto: 8, set: 9, setembro: 9, out: 10, outubro: 10, nov: 11, novembro: 11, dez: 12, dezembro: 12,
};

const pad = (n: number) => String(n).padStart(2, "0");
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const validYMD = (y: number, m: number, d: number) => y >= 2000 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= daysIn(y, m);
const fullYear = (y: number) => (y < 100 ? 2000 + y : y);
const strip = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Hoje em Brasília, como "AAAA-MM-DD".
export const todayISO = (now = new Date()) => new Date(now.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);

const dayNumber = (isoDay: string) => Date.UTC(+isoDay.slice(0, 4), +isoDay.slice(5, 7) - 1, +isoDay.slice(8, 10)) / 86_400_000;

// Dias de hoje até a data (negativo = já venceu).
export const daysUntil = (isoDay: string, today: string) => Math.round(dayNumber(isoDay) - dayNumber(today));

// Mesmo dia, um ano depois (29/02 cai em 28/02).
export function addYear(isoDay: string): string {
  const y = +isoDay.slice(0, 4) + 1;
  const m = +isoDay.slice(5, 7);
  return iso(y, m, Math.min(+isoDay.slice(8, 10), daysIn(y, m)));
}

// Data guardada no banco (meia-noite de Brasília) ↔ "AAAA-MM-DD".
export const renewalDate = (isoDay: string) => new Date(`${isoDay}T00:00:00-03:00`);
export const renewalISO = (d: Date) => new Date(d.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);

export const formatISO = (isoDay: string) => `${isoDay.slice(8, 10)}/${isoDay.slice(5, 7)}/${isoDay.slice(0, 4)}`;

// "em 12 dias", "amanhã", "venceu há 3 dias".
export function renewalWhen(days: number): string {
  if (days === 0) return "vence hoje";
  if (days === 1) return "vence amanhã";
  if (days > 1) return `vence em ${days} dias`;
  return days === -1 ? "venceu ontem" : `venceu há ${-days} dias`;
}

// Lê uma data de planilha. Entende 15/03/2027, 15-03-27, 2027-03-15, 15.03.2027, "15 de março de 2027",
// 15/mar/2027, número de data do Excel (46000), "mar/2027" (vale o último dia do mês) e "15/03" (próxima vez que cai).
// Intervalo ("01/03/2026 a 01/03/2027") vale o fim. Devolve "AAAA-MM-DD" ou null.
export function parseRenewalDate(raw: string, now = new Date()): string | null {
  let s = strip(raw).trim();
  if (!s) return null;
  const parts = s.split(/\s+(?:a|ate|-)\s+|\s*[–—]\s*/).filter((p) => /\d/.test(p));
  if (parts.length > 1) s = parts[parts.length - 1].trim();
  const today = todayISO(now);
  const ty = +today.slice(0, 4);

  // Número de data do Excel (dias desde 30/12/1899).
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const serial = Math.floor(+s);
    if (serial >= 36526 && serial <= 73415) return new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000).toISOString().slice(0, 10);
    return null;
  }

  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[t\s].*)?$/);
  if (m) return validYMD(+m[1], +m[2], +m[3]) ? iso(+m[1], +m[2], +m[3]) : null;

  m = s.match(/^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{2}|\d{4})(?:[t\s].*)?$/);
  if (m) {
    const y = fullYear(+m[3]);
    let d = +m[1];
    let mo = +m[2];
    if (mo > 12 && d <= 12) [d, mo] = [mo, d]; // veio como mês/dia (formato americano)
    return validYMD(y, mo, d) ? iso(y, mo, d) : null;
  }

  // Dia, mês por extenso ou abreviado, ano opcional: "15 de marco de 2027", "15/mar/27", "15 mar".
  m = s.match(/^(\d{1,2})\s*(?:de|[-/. ])?\s*([a-z]{3,9})\.?\s*(?:de|[-/. ])?\s*(\d{2}|\d{4})?$/);
  if (m && MONTHS[m[2]]) {
    const mo = MONTHS[m[2]];
    const d = +m[1];
    if (m[3]) return validYMD(fullYear(+m[3]), mo, d) ? iso(fullYear(+m[3]), mo, d) : null;
    return nextOccurrence(mo, d, today, ty);
  }

  // Mês e ano: "mar/2027", "março de 2027", "03/2027".
  m = s.match(/^([a-z]{3,9})\.?\s*(?:de|[-/. ])?\s*(\d{2}|\d{4})$/);
  if (m && MONTHS[m[1]]) {
    const y = fullYear(+m[2]);
    return validYMD(y, MONTHS[m[1]], 1) ? iso(y, MONTHS[m[1]], daysIn(y, MONTHS[m[1]])) : null;
  }
  m = s.match(/^(\d{1,2})[-/.](\d{4})$/);
  if (m) {
    const y = +m[2];
    return validYMD(y, +m[1], 1) ? iso(y, +m[1], daysIn(y, +m[1])) : null;
  }

  // Dia e mês sem ano: "15/03".
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})$/);
  if (m) return nextOccurrence(+m[2], +m[1], today, ty);
  return null;
}

// Próxima vez em que dia/mês cai (hoje conta).
function nextOccurrence(month: number, day: number, today: string, year: number): string | null {
  const thisYear = validYMD(year, month, day) ? iso(year, month, day) : null;
  if (thisYear && thisYear >= today) return thisYear;
  return validYMD(year + 1, month, day) ? iso(year + 1, month, day) : null;
}
