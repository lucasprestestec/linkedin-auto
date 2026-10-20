import assert from "node:assert/strict";
import { syncAlerts } from "./syncReport";

// Rodar: npx tsx src/lib/syncReport.test.ts
const now = new Date("2026-10-20T12:00:00Z");
const iso = (minAgo: number) => new Date(now.getTime() - minAgo * 60_000).toISOString();
const rep = (finished: number, channels = {}) => ({ finishedAt: iso(finished), channels });

assert.deepEqual(syncAlerts(null, now, now), []);
assert.deepEqual(syncAlerts(rep(2, { email: { okAt: iso(2), error: null, at: iso(2) } }), now, new Date(iso(1))), []);
assert.equal(syncAlerts(rep(2, { whatsapp: { okAt: iso(90), error: "sem sessão", at: iso(2) } }), now, new Date(iso(1)))[0].key, "sync-whatsapp");
// robô chama (1 min atrás) mas a última rodada concluída foi há 2h: aviso de rodada travada
assert.equal(syncAlerts(rep(120), now, new Date(iso(1)))[0].key, "sync-round");
// robô parado há 3h: quem avisa é a central local, não este aviso
assert.deepEqual(syncAlerts(rep(180), now, new Date(iso(180))), []);
console.log("ok");
