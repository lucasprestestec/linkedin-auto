import assert from "node:assert/strict";
import { hotScore, hotSignals, type SignalMessage } from "./hotSignals";

// Rodar: npx tsx src/lib/hotSignals.test.ts
const now = new Date("2026-10-20T12:00:00Z");
const msg = (sender: SignalMessage["sender"], content: string, hoursAgo = 1, openCount = 0): SignalMessage => ({ sender, content, openCount, at: new Date(now.getTime() - hoursAgo * 3_600_000) });

const s = hotSignals({
  status: "CONVERSATION_OPEN",
  jobTitle: "Sócio · Barros Indústria",
  now,
  messages: [msg("AGENT", "Oi! Como vocês cuidam do plano?", 30), msg("LEAD", "Nosso contrato vence em março. Pode me mandar uma proposta?", 2)],
});
const keys = s.map((x) => x.key);
assert.ok(keys.includes("price") && keys.includes("renewal") && keys.includes("decider") && keys.includes("waiting"));
assert.match(s.find((x) => x.key === "price")!.quote!, /proposta/);
assert.equal(hotScore(s), 3 + 2 + 1 + 2);

// sem sinal nenhum: nada a explicar
assert.deepEqual(hotSignals({ status: "WAITING_REPLY", jobTitle: null, now, messages: [msg("AGENT", "Oi", 5)] }), []);
// o assistente falando de proposta não conta como interesse da pessoa
assert.equal(hotSignals({ status: "WAITING_REPLY", jobTitle: null, now, messages: [msg("AGENT", "Posso mandar uma proposta?", 5)] }).length, 0);
// aberturas de e-mail
assert.ok(hotSignals({ status: "WAITING_REPLY", jobTitle: null, now, messages: [msg("AGENT", "x", 5, 3)] }).some((x) => x.key === "opens"));
// respondeu faz pouco, e o último a falar foi o assistente
assert.ok(hotSignals({ status: "CONVERSATION_OPEN", jobTitle: null, now, messages: [msg("LEAD", "ok", 10), msg("AGENT", "show", 9)] }).some((x) => x.key === "recent"));
console.log("ok");
