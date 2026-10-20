// Confere se a configuração atual ainda acerta os casos que o corretor corrigiu ("não é meu jeito").
// Rode ANTES de liberar uma mudança no jeito de escrever, na base de conhecimento ou no modelo.
// Uso: npx tsx scripts/eval-regression.ts --judge <modelo-avaliador> [--model <modelo>]
// Sai com código 1 se algum caso falhar.
import { config } from "dotenv";

config({ path: ".env.local" });

const arg = (name: string, fallback = "") => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};

async function main() {
  const { conversationModel } = await import("../src/lib/agent");
  const { runScenario } = await import("../src/lib/agentEval/run");
  const { loadFeedbackScenarios, passed } = await import("../src/lib/agentEval/feedbackCases");

  const judge = arg("judge");
  if (!judge) throw new Error("Informe o modelo avaliador: --judge <modelo>");
  const model = arg("model") || (await conversationModel());
  const cases = await loadFeedbackScenarios();
  if (cases.length === 0) {
    console.log("Nenhuma correção guardada ainda: nada a conferir.");
    return;
  }
  console.log(`Modelo: ${model} · avaliador: ${judge} · ${cases.length} casos\n`);

  let failed = 0;
  for (const c of cases) {
    const r = await runScenario(c.id, model, judge);
    const ok = passed(r);
    if (!ok) failed++;
    console.log(`${ok ? "PASSOU" : "FALHOU"}  ${c.title}${ok ? "" : `\n        ${r.error ?? r.judge?.comment ?? "sem avaliação"}\n        resposta: ${r.message ?? r.reason ?? "-"}`}`);
  }
  console.log(`\n${cases.length - failed} de ${cases.length} passaram.`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
