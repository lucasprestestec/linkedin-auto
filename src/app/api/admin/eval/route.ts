import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { runScenario } from "@/lib/agentEval/run";

// Um cenário × um modelo por requisição. É rota (e não server action) de
// propósito: server actions rodam em fila no navegador, e o banco de testes
// precisa de várias chamadas ao mesmo tempo.
export const maxDuration = 120;

export async function POST(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Acesso restrito." }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { scenarioId?: string; model?: string; judgeModel?: string | null } | null;
  if (!body?.scenarioId || !body.model) return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
  return NextResponse.json(await runScenario(body.scenarioId, body.model, body.judgeModel || null));
}
