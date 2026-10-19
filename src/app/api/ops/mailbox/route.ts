import { NextResponse } from "next/server";
import { opsAuthorized } from "@/lib/ops";
import { addMailbox, testMailbox, type MailboxInput } from "@/lib/mailboxAdmin";

// Testar o envio e a leitura de uma caixa pode levar alguns segundos.
export const maxDuration = 60;

// Cadastra ou testa uma caixa de envio. Chamado só pela central do dono (ver lib/ops.ts).
export async function POST(request: Request) {
  if (!opsAuthorized(request)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as ({ action?: string; id?: string } & Partial<MailboxInput>) | null;
  if (body?.action === "add") return NextResponse.json(await addMailbox(body as MailboxInput));
  if (body?.action === "test" && body.id) return NextResponse.json(await testMailbox(String(body.id)));
  return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
}
