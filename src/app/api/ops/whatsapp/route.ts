import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { opsAuthorized } from "@/lib/ops";
import { deskcommConfigOf, fixedDeskcommUrl, inspectDeskcomm, saveDeskcommConnection, whatsappLiveStatus } from "@/lib/deskcomm";

const SELECT = { deskcommUrl: true, deskcommToken: true, deskcommChannelId: true } as const;
const unauthorized = () => NextResponse.json({ error: "Não autorizado." }, { status: 401 });

// Estado da conexão com o CRM de WhatsApp: se há chave e se o número está conectado.
export async function GET(request: Request) {
  if (!opsAuthorized(request)) return unauthorized();
  const s = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" }, select: SELECT });
  const cfg = deskcommConfigOf(s);
  return NextResponse.json({ hasKey: Boolean(s.deskcommToken), live: cfg ? await whatsappLiveStatus(cfg) : "sem-chave", channelId: s.deskcommChannelId });
}

// Testa a chave no CRM e guarda cifrada com o segredo deste sistema: a central nunca precisa dele.
export async function PUT(request: Request) {
  if (!opsAuthorized(request)) return unauthorized();
  const body = (await request.json().catch(() => null)) as { token?: string } | null;
  const token = String(body?.token ?? "").trim();
  if (!token) return NextResponse.json({ error: "Cole a chave." }, { status: 400 });
  const url = fixedDeskcommUrl();
  try {
    const found = await inspectDeskcomm({ url, token });
    if (found.missingTools.length) return NextResponse.json({ error: "A chave não tem todas as permissões (precisa de mcp:read, mcp:write e role:manager)." }, { status: 400 });
    const current = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" }, select: { deskcommChannelId: true } });
    await saveDeskcommConnection(url, token, found.channelId ?? current.deskcommChannelId);
    return NextResponse.json({ saved: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Não foi possível testar a chave." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  if (!opsAuthorized(request)) return unauthorized();
  await prisma.settings.update({ where: { id: "singleton" }, data: { deskcommUrl: null, deskcommToken: null, deskcommChannelId: null } });
  return NextResponse.json({ removed: true });
}
