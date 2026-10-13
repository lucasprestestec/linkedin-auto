// Confere as regras de agenda da Helena (Base, Parte 6): a partir do próximo dia útil e 2 horários por vez.
// Uso: npx tsx scripts/test-slots-helena.ts
import assert from "node:assert/strict";
import { calendarContextFrom } from "../src/lib/scheduling";
import { checkSlot, freeStarts, nextBusinessDayStart, noticeLabel, slotIso, type SlotRules } from "../src/lib/slots";

const base: SlotRules = { workStartHour: 8, workEndHour: 18, workWeekdaysOnly: true, minutes: 30 };
const helena: SlotRules = { ...base, fromNextBusinessDay: true, offerCount: 2 };
const at = (iso: string) => new Date(iso);

// Terça 13/10/2026, 10h: o próximo dia útil é quarta 14/10.
const tue = at("2026-10-13T10:00:00-03:00");
assert.equal(slotIso(nextBusinessDayStart(tue)), "2026-10-14T00:00:00-03:00");
// Sexta e fim de semana: o próximo dia útil é segunda.
assert.equal(slotIso(nextBusinessDayStart(at("2026-10-16T17:00:00-03:00"))), "2026-10-19T00:00:00-03:00");
assert.equal(slotIso(nextBusinessDayStart(at("2026-10-17T11:00:00-03:00"))), "2026-10-19T00:00:00-03:00");

// Com a regra, nada de hoje; sem a regra, ainda sai horário de hoje à tarde (antecedência de 4h).
assert.equal(slotIso(freeStarts([], tue, helena)[0]), "2026-10-14T08:00:00-03:00");
assert.equal(slotIso(freeStarts([], tue, base)[0]), "2026-10-13T14:00:00-03:00");

// Conferência na hora de oferecer ou marcar.
assert.equal(checkSlot(at("2026-10-13T16:00:00-03:00"), [], tue, helena).ok, false);
assert.equal(checkSlot(at("2026-10-14T10:00:00-03:00"), [], tue, helena).ok, true);
// Horário quebrado e conflito continuam barrados.
assert.equal(checkSlot(at("2026-10-14T10:15:00-03:00"), [], tue, helena).ok, false);
assert.equal(checkSlot(at("2026-10-14T10:00:00-03:00"), [{ start: at("2026-10-14T09:30:00-03:00"), end: at("2026-10-14T10:30:00-03:00") }], tue, helena).ok, false);

// 2 horários por vez, todos de quarta em diante; o corretor comum continua com 3.
const ctx = calendarContextFrom([], tue, helena);
assert.equal(ctx.suggestions.length, 2);
assert.ok(ctx.suggestions.every((s) => s.iso >= "2026-10-14"));
assert.equal(calendarContextFrom([], tue, base).suggestions.length, 3);

assert.equal(noticeLabel(helena), "a partir do próximo dia útil");
assert.equal(noticeLabel(base), "com 4 horas de antecedência");
console.log("ok: regras de agenda da Helena");
