import assert from "node:assert/strict";
import { buildFeedbackScenario, passed } from "./feedbackCases";

// Rodar: npx tsx src/lib/agentEval/feedbackCases.test.ts
const row = {
  id: "abc",
  agentText: "Olá! Gostaria de agendar uma conversa de 30 minutos para apresentar nossas soluções.",
  reasons: ["long", "formal"],
  note: "muito engessado",
  corrected: "Oi! Posso te ligar 10 min amanhã?",
  context: [
    { sender: "AGENT", channel: "WHATSAPP", content: "Oi [nome], tudo bem?" },
    { sender: "LEAD", channel: "WHATSAPP", content: "Tudo, quem é você?" },
    { sender: "AGENT", channel: "WHATSAPP", content: "resposta criticada que já saiu" },
  ],
};
const s = buildFeedbackScenario(row)!;
assert.equal(s.id, "fb-abc");
assert.equal(s.history.length, 2); // a resposta criticada sai: o assistente responde de novo à última do lead
assert.equal(s.history.at(-1)!.sender, "LEAD");
assert.equal(s.channel, "WHATSAPP");
assert.match(s.rubric, /Muito longa; Formal demais/);
assert.match(s.rubric, /Posso te ligar 10 min/);
assert.equal(buildFeedbackScenario({ ...row, context: [{ sender: "AGENT", channel: "EMAIL", content: "x" }] }), null); // sem fala do lead não há o que responder
assert.equal(buildFeedbackScenario({ ...row, context: null }), null);
assert.equal(passed({ ok: true, judge: { competence: 4, invented: false, brokeRule: false } }), true);
assert.equal(passed({ ok: true, judge: { competence: 3, invented: false, brokeRule: false } }), false);
assert.equal(passed({ ok: true, judge: { competence: 5, invented: true, brokeRule: false } }), false);
assert.equal(passed({ ok: true }), false);
console.log("ok");
