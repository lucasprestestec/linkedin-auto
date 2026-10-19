import { NextResponse } from "next/server";
import { opsAuthorized } from "@/lib/ops";
import { conversationModel } from "@/lib/agent";
import { listNousModels, runScenario } from "@/lib/agentEval/run";
import { QUICK_IDS, SCENARIOS } from "@/lib/agentEval/scenarios";

// Um cenário × um modelo por requisição: o banco de testes precisa de várias chamadas ao mesmo tempo.
export const maxDuration = 120;

// O que a central precisa para montar o banco de testes: modelos, cenários e o modelo atual.
export async function GET(request: Request) {
  if (!opsAuthorized(request)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const current = await conversationModel();
  const scenarios = SCENARIOS.map(({ id, title, category }) => ({ id, title, category }));
  try {
    return NextResponse.json({ models: await listNousModels(), current, scenarios, quickIds: QUICK_IDS });
  } catch (err) {
    return NextResponse.json({ models: [], current, scenarios, quickIds: QUICK_IDS, error: err instanceof Error ? err.message : "Não foi possível listar os modelos." });
  }
}

export async function POST(request: Request) {
  if (!opsAuthorized(request)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { scenarioId?: string; model?: string; judgeModel?: string | null } | null;
  if (!body?.scenarioId || !body.model) return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
  return NextResponse.json(await runScenario(body.scenarioId, body.model, body.judgeModel || null));
}
