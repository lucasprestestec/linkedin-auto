// Confere quais cargas da imagem de rastreio contam como abertura. Sem banco e sem rede.
// Uso: npx tsx scripts/test-open-tracking.ts
import assert from "node:assert/strict";
import { AUTO_OPEN_SECONDS, isAutoOpen } from "../src/lib/openTracking";

const sent = new Date("2026-10-15T20:14:35.000Z");
const after = (s: number) => new Date(sent.getTime() + s * 1000);

assert.equal(AUTO_OPEN_SECONDS, 60);
// Os casos medidos de verdade no Gmail: 2, 4 e 6 segundos depois do envio.
assert.equal(isAutoOpen(sent, after(2)), true);
assert.equal(isAutoOpen(sent, after(4)), true);
assert.equal(isAutoOpen(sent, after(6)), true);
assert.equal(isAutoOpen(sent, after(0)), true);
// Limite: até 59 s não conta; com 60 s ou mais, conta.
assert.equal(isAutoOpen(sent, after(59)), true);
assert.equal(isAutoOpen(sent, after(60)), false);
assert.equal(isAutoOpen(sent, after(180)), false);
// Sem data de envio, não esconde a abertura (melhor contar a mais do que perder).
assert.equal(isAutoOpen(null, after(3)), false);
assert.equal(isAutoOpen(undefined, after(3)), false);

console.log("ok: test-open-tracking");
