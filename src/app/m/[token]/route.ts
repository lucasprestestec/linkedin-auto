import { prisma } from "@/lib/prisma";
import { isMaterialToken, mimeInline } from "@/lib/materials";

// Endereço público de um material (o que o corretor manda ao cliente). O código é impossível de adivinhar;
// material desligado ou apagado responde 404. Link externo redireciona; arquivo é entregue daqui.
export const dynamic = "force-dynamic";

// Programas que só "espiam" o link (prévia do WhatsApp, Google, etc.) não contam como abertura.
const PREVIEW_BOT = /bot|crawler|spider|preview|facebookexternalhit|whatsapp|slack|telegram|embedly|skype|curl|wget/i;

const notFound = () => new Response("Material não encontrado.", { status: 404, headers: { "X-Robots-Tag": "noindex" } });

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isMaterialToken(token)) return notFound();
  const m = await prisma.material.findUnique({ where: { token } });
  if (!m || !m.active) return notFound();

  if (!PREVIEW_BOT.test(request.headers.get("user-agent") ?? "")) {
    await prisma.material.update({ where: { id: m.id }, data: { opens: { increment: 1 }, lastOpenAt: new Date() } }).catch(() => {});
  }
  if (m.kind === "LINK" && m.url) return Response.redirect(m.url, 302);
  if (!m.data || !m.mimeType) return notFound();

  const name = encodeURIComponent(m.fileName ?? "material");
  return new Response(new Uint8Array(m.data), {
    headers: {
      "Content-Type": m.mimeType,
      "Content-Length": String(m.data.length),
      "Content-Disposition": `${mimeInline(m.mimeType) ? "inline" : "attachment"}; filename*=UTF-8''${name}`,
      "Cache-Control": "private, max-age=300",
      "X-Robots-Tag": "noindex",
    },
  });
}
