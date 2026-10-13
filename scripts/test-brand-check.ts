// Confere a trava de termos proibidos da Helena (agentCheck) e o aviso fixo de urgência. Sem banco e sem IA.
// Uso: npx tsx scripts/test-brand-check.ts
import assert from "node:assert/strict";
import { checkMessage } from "../src/lib/agentCheck";
import { HANDOFF_ACK } from "../src/lib/agent";

const check = (message: string, extra: { brandRules?: boolean; incoming?: string } = {}) =>
  checkMessage({ message, previousOutgoing: [], instructions: null, allowAiDisclosure: true, brandRules: true, ...extra });
const blocked = (m: string, extra?: { incoming?: string }) => assert.ok(check(m, extra).length > 0, `devia barrar: ${m}`);
const fine = (m: string, extra?: { incoming?: string }) => assert.deepEqual(check(m, extra), [], `devia passar: ${m}`);

blocked("A gente trabalha com a Prudential e outras.");
blocked("Trabalhamos com a Unimed.");
blocked("Fazemos a reunião de graça.");
blocked("A DOR$ também atende nos Estados Unidos.");
blocked("Nosso especialista é do MDRT, que reúne 1% dos melhores.");
blocked("Isso é do DOR$ Private.");
blocked("Esse é o modelo americano de proteção.");

fine("A reunião não tem custo, nem a entrega do diagnóstico.");
fine("A gente trabalha com as melhores opções do mercado, e o especialista te mostra o que faz sentido.");
fine("Entendi o seu seguro do Bradesco. Vale o especialista conferir se ele acompanha o seu momento.", { incoming: "Já tenho seguro do Bradesco" });
blocked("Entendi o seu seguro do Bradesco.", { incoming: "Já tenho seguro" });

// Sem nome próprio (corretor comum) a lista não vale.
assert.deepEqual(check("A gente trabalha com a Prudential.", { brandRules: false }), []);

// O aviso fixo de urgência passa na própria conferência (não pode ser barrado por ela).
for (const [kind, text] of Object.entries(HANDOFF_ACK)) {
  assert.deepEqual(checkMessage({ message: text, previousOutgoing: [], instructions: null, allowAiDisclosure: true, brandRules: true }), [], kind);
}
assert.match(HANDOFF_ACK.sinistro, /Sinto muito pelo que aconteceu/);
console.log("ok: trava de termos proibidos e aviso de urgência");
