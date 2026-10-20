import { NextResponse } from "next/server";
import { opsAuthorized } from "@/lib/ops";
import { buildStatus } from "@/lib/saude";

export const dynamic = "force-dynamic";

// Retrato do sistema para a central local do dono: gasto de IA, caixas, limites, canais e o que precisa de atenção.
export async function GET(request: Request) {
  if (!opsAuthorized(request)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  try {
    return NextResponse.json(await buildStatus());
  } catch (err) {
    console.error("Falha ao montar o retrato do sistema", err);
    return NextResponse.json({ error: "Não consegui montar o retrato do sistema." }, { status: 500 });
  }
}
