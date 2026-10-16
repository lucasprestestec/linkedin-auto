// Confere a situação de cada hora na tela Agenda (livre, bloqueada, ocupada). Sem banco e sem Google.
// Uso: npx tsx scripts/test-hour-blocks.ts
import assert from "node:assert/strict";
import { hourSlotsFor } from "../src/lib/hourBlocks";

const at = (hhmm: string) => new Date(`2026-10-19T${hhmm}:00-03:00`);
const ev = (id: string, from: string, to: string, extra: object = {}) => ({ id, start: at(from), end: at(to), allDay: false, busy: true, blocked: false, ...extra });

const slots = hourSlotsFor(
  "2026-10-19",
  8,
  13,
  [
    ev("reuniao", "09:30", "10:00"),
    ev("bloq", "11:00", "12:00", { blocked: true }),
    ev("livre-no-google", "12:00", "13:00", { busy: false }),
    { ...ev("feriado", "00:00", "23:59"), allDay: true },
  ],
  at("08:30"),
);
// 8h já passou (agora é 8h30); 9h tem reunião; 10h livre; 11h bloqueada por nós; 12h só tem evento "livre".
assert.deepEqual(
  slots.map((s) => [s.label, s.state, s.blockId]),
  [
    ["9h", "busy", null],
    ["10h", "free", null],
    ["11h", "blocked", "bloq"],
    ["12h", "free", null],
  ],
);
assert.equal(slots[0].iso, "2026-10-19T12:00:00.000Z");
console.log("ok: horas da agenda");
