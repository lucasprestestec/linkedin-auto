import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// Baixa todos os temas da base de conhecimento num .md (cópia de segurança antes de substituir).
// Cada tema já traz o próprio título no texto, então o arquivo pode ser importado de volta.
export async function GET() {
  if (!(await getSession())) return new Response("Não autorizado", { status: 401 });
  const sections = await prisma.knowledgeSection.findMany({ orderBy: { position: "asc" } });
  const body = sections.map((s) => s.content.trim()).join("\n\n");
  const day = new Date().toISOString().slice(0, 10);
  return new Response(body, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="temas-da-assistente-${day}.md"`,
      "cache-control": "no-store",
    },
  });
}
