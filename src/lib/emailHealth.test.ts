import assert from "node:assert/strict";
import { adviceFor, type BoxHealth } from "./emailHealth";

// Rodar: npx tsx src/lib/emailHealth.test.ts
const base: BoxHealth = { address: "a@x.com", domain: "x.com", sent30: 10, sentTotal: 100, bounces: 0, lastError: null, auth: { spf: "ok", dmarc: "quarantine", dkim: true } };
assert.deepEqual(adviceFor(base), []);
assert.equal(adviceFor({ ...base, bounces: 6 })[0].level, "erro"); // 6%
assert.equal(adviceFor({ ...base, bounces: 3 })[0].level, "aviso"); // 3%
assert.deepEqual(adviceFor({ ...base, sentTotal: 10, bounces: 5 }), []); // amostra pequena não alarma
assert.equal(adviceFor({ ...base, auth: { spf: "ausente", dmarc: "ausente", dkim: false } }).length, 3);
assert.equal(adviceFor({ ...base, lastError: "auth failed" })[0].level, "erro");
assert.deepEqual(adviceFor({ ...base, auth: null }), []);
console.log("ok");
