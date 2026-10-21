import assert from "node:assert/strict";
import { addYear, daysUntil, formatISO, parseRenewalDate, renewalWhen } from "./renewal";

// Rodar: npx tsx src/lib/renewal.test.ts
const now = new Date("2026-10-21T15:00:00Z");
const p = (s: string) => parseRenewalDate(s, now);

// Formatos comuns de planilha
assert.equal(p("15/03/2027"), "2027-03-15");
assert.equal(p("15-03-2027"), "2027-03-15");
assert.equal(p("15.03.27"), "2027-03-15");
assert.equal(p("5/3/2027"), "2027-03-05");
assert.equal(p("2027-03-15"), "2027-03-15");
assert.equal(p("2027-03-15T00:00:00.000Z"), "2027-03-15");
assert.equal(p("15 de março de 2027"), "2027-03-15");
assert.equal(p("15/mar/2027"), "2027-03-15");
assert.equal(p("1 Dez 26"), "2026-12-01");
assert.equal(p("  15/03/2027  "), "2027-03-15");

// Número de data do Excel: 46461 = 15/03/2027
assert.equal(p("46461"), "2027-03-15");
assert.equal(p("46461.0"), "2027-03-15");
assert.equal(p("12345"), null);

// Mês e ano valem o último dia do mês; dia/mês sem ano vale a próxima vez que cai
assert.equal(p("mar/2027"), "2027-03-31");
assert.equal(p("fev/2028"), "2028-02-29");
assert.equal(p("03/2027"), "2027-03-31");
assert.equal(p("15/03"), "2027-03-15");
assert.equal(p("21/10"), "2026-10-21");
assert.equal(p("20/10"), "2027-10-20");

// Intervalo de vigência: vale o fim
assert.equal(p("15/03/2026 a 15/03/2027"), "2027-03-15");
assert.equal(p("15/03/2026 - 15/03/2027"), "2027-03-15");

// Mês/dia (americano) só quando não há outra leitura
assert.equal(p("03/25/2027"), "2027-03-25");

// Lixo e datas que não existem
assert.equal(p(""), null);
assert.equal(p("sem data"), null);
assert.equal(p("31/02/2027"), null);
assert.equal(p("00/00/0000"), null);

// Contas de prazo
assert.equal(daysUntil("2026-11-20", "2026-10-21"), 30);
assert.equal(daysUntil("2026-10-18", "2026-10-21"), -3);
assert.equal(addYear("2026-12-01"), "2027-12-01");
assert.equal(addYear("2028-02-29"), "2029-02-28");
assert.equal(formatISO("2027-03-05"), "05/03/2027");
assert.equal(renewalWhen(0), "vence hoje");
assert.equal(renewalWhen(1), "vence amanhã");
assert.equal(renewalWhen(12), "vence em 12 dias");
assert.equal(renewalWhen(-3), "venceu há 3 dias");

console.log("ok");
