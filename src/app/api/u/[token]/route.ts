import { prisma } from "@/lib/prisma";
import { leadIdFromUnsubscribeToken } from "@/lib/unsubscribe";

// "Não quero mais receber": link do rodapé dos e-mails. Público (quem clica não tem login), por isso só
// vale com o código assinado. O GET só mostra o botão (programas que abrem links para checar não descadastram
// ninguém); o POST descadastra, e também atende o botão "cancelar inscrição" do Gmail (List-Unsubscribe-Post).
const page = (title: string, body: string) =>
  new Response(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>` +
      `<body style="font-family:Arial,sans-serif;max-width:420px;margin:15vh auto;padding:0 16px;color:#222;text-align:center"><h1 style="font-size:20px">${title}</h1>${body}</body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token;
  if (!leadIdFromUnsubscribeToken(token)) return page("Link inválido", "<p>Este link não é válido.</p>");
  return page(
    "Não quer mais receber nossas mensagens?",
    `<form method="post"><button style="font-size:16px;padding:10px 20px;cursor:pointer">Sim, não quero mais receber</button></form>`,
  );
}

export async function POST(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const leadId = leadIdFromUnsubscribeToken((await params).token);
  if (!leadId) return page("Link inválido", "<p>Este link não é válido.</p>");
  await prisma.lead.updateMany({ where: { id: leadId }, data: { doNotContact: true } });
  // O que estava esperando para sair também não sai.
  await prisma.draft.updateMany({
    where: { leadId, status: { in: ["PENDING", "APPROVED"] } },
    data: { status: "DISCARDED", decidedAt: new Date(), error: "A pessoa pediu para não receber mais mensagens." },
  });
  return page("Pronto", "<p>Você não vai mais receber mensagens nossas, por nenhum canal.</p>");
}
