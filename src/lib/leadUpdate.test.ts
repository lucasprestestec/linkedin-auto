import assert from "node:assert/strict";

// Rodar: npx tsx src/lib/leadUpdate.test.ts
async function main() {
  const { sanitizeProposal, validDue, isEmptyProposal, appendNote, appendPersonal, dueDate } = await import("./leadUpdate");
  const today = "2026-10-21";

  // datas: só de hoje até 2 anos, e existentes
  assert.equal(validDue("2026-10-23", today), "2026-10-23");
  assert.equal(validDue("2026-10-21", today), "2026-10-21");
  assert.equal(validDue("2026-10-20", today), null); // passado
  assert.equal(validDue("2026-02-30", today), null); // dia que não existe
  assert.equal(validDue("2029-01-01", today), null); // longe demais
  assert.equal(validDue("sexta", today), null);

  const p = sanitizeProposal(
    {
      summary: "  Conversou com a Ana  ",
      note: "40 funcionários, quer proposta",
      personal: "",
      tasks: [{ title: "Enviar proposta", due: "2026-10-23" }, { title: "Ligar", due: "ontem" }, { title: "   " }, { due: "2026-10-25" }, "lixo", ...Array.from({ length: 9 }, (_, i) => ({ title: `t${i}` }))],
      deal: { stage: "PROPOSAL", valueReais: 12500.5, reason: "x".repeat(500) },
    },
    today,
  );
  assert.equal(p.summary, "Conversou com a Ana");
  assert.equal(p.personal, null);
  assert.equal(p.tasks.length, 5); // no máximo 5
  assert.deepEqual(p.tasks[0], { title: "Enviar proposta", due: "2026-10-23" });
  assert.deepEqual(p.tasks[1], { title: "Ligar", due: null }); // data inválida vira sem data
  assert.equal(p.deal?.stage, "PROPOSAL");
  assert.equal(p.deal?.valueCents, 1250050);
  assert.equal(p.deal?.reason?.length, 300);

  // estágio inventado ou valor negativo não passam
  assert.equal(sanitizeProposal({ deal: { stage: "toString" } }, today).deal, null);
  assert.equal(sanitizeProposal({ deal: { stage: "WON", valueReais: -5 } }, today).deal?.valueCents, null);
  // proposta já limpa (centavos) volta do navegador e não pode perder o valor
  assert.equal(sanitizeProposal({ deal: { stage: "PROPOSAL", valueCents: 1250000 } }, today).deal?.valueCents, 1250000);
  assert.ok(isEmptyProposal(sanitizeProposal(null, today)));
  assert.ok(isEmptyProposal(sanitizeProposal("texto", today)));

  // anotações somam, não apagam
  const now = new Date("2026-10-21T15:00:00Z");
  assert.equal(appendNote(null, "Quer proposta", now), "[21/10] Quer proposta");
  assert.equal(appendNote("[10/10] Primeiro contato", "Quer proposta", now), "[10/10] Primeiro contato\n[21/10] Quer proposta");
  assert.equal(appendPersonal("Tem 2 filhos", "Torce pro Grêmio"), "Tem 2 filhos\nTorce pro Grêmio");

  // o dia do lembrete é o início do dia em Brasília
  assert.equal(dueDate("2026-10-23").toISOString(), "2026-10-23T03:00:00.000Z");
  console.log("ok");
}
main();
