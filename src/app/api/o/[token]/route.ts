import { prisma } from "@/lib/prisma";

// Imagem invisível dos e-mails enviados: cada vez que carrega, conta uma
// abertura. Público (o app de e-mail do cliente não tem login), por isso só
// aceita o código aleatório gravado na mensagem e não devolve nada além do GIF.
const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token.replace(/\.gif$/, "");
  if (/^[\w-]{20,40}$/.test(token)) {
    const now = new Date();
    const msg = await prisma.message.findUnique({ where: { openToken: token }, select: { id: true, firstOpenedAt: true } });
    if (msg) {
      await prisma.message.update({
        where: { id: msg.id },
        data: { openCount: { increment: 1 }, lastOpenedAt: now, firstOpenedAt: msg.firstOpenedAt ?? now },
      });
    }
  }
  return new Response(GIF, {
    headers: { "content-type": "image/gif", "cache-control": "no-store, no-cache, must-revalidate, max-age=0", "content-length": String(GIF.length) },
  });
}
