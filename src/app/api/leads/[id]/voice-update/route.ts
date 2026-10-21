import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { understandBytes } from "@/lib/mediaUnderstanding";
import { extractLeadUpdate } from "@/lib/leadUpdate";

// O áudio gravado pelo corretor chega aqui como WAV (rota e não ação de servidor: a ação limita o corpo a 1 MB).
// Responde com a transcrição e a proposta de mudanças; nada é gravado na ficha neste passo.
export const maxDuration = 60;
const MAX_BYTES = 4 * 1024 * 1024; // ~2 minutos de WAV 16 kHz mono (a Vercel aceita até 4,5 MB)

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getSession())) return NextResponse.json({ error: "Sessão expirada. Entre de novo." }, { status: 401 });
  const { id } = await params;
  const lead = await prisma.lead.findUnique({ where: { id }, select: { id: true, firstName: true, lastName: true, jobTitle: true, status: true, notes: true, personal: true } });
  if (!lead) return NextResponse.json({ error: "Contato não encontrado." }, { status: 404 });

  const bytes = Buffer.from(await request.arrayBuffer());
  if (bytes.length < 2000) return NextResponse.json({ error: "O áudio ficou curto demais. Grave de novo." }, { status: 422 });
  if (bytes.length > MAX_BYTES) return NextResponse.json({ error: "O áudio passou de 2 minutos. Grave em partes menores." }, { status: 413 });

  const heard = await understandBytes("audio", bytes, "audio/wav");
  if (!heard.ok) return NextResponse.json({ error: `Não consegui ouvir o áudio: ${heard.reason}.` }, { status: 422 });
  try {
    return NextResponse.json({ transcript: heard.text, proposal: await extractLeadUpdate(heard.text, lead) });
  } catch (err) {
    console.error("Falha ao propor a atualização por voz", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Não consegui montar a proposta agora. Tente de novo." }, { status: 502 });
  }
}
