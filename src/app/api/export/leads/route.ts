import { prisma } from "@/lib/prisma";
import { STATUS_LABEL } from "@/lib/status";

// Exporta os leads em CSV. Protegida pelo login do painel (proxy.ts): só
// /api/cron e /api/webhooks ficam de fora da sessão.
// Separador ";" e BOM UTF-8 — é o que o Excel em português abre certo.

function cell(value: unknown): string {
  const text = value == null ? "" : String(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function date(d: Date | null | undefined): string {
  return d ? d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "";
}

// ?ids=a,b,c exporta só os leads selecionados na tabela.
export async function GET(request: Request) {
  const ids = new URL(request.url).searchParams.get("ids")?.split(",").filter(Boolean);
  const leads = await prisma.lead.findMany({
    where: ids?.length ? { id: { in: ids } } : undefined,
    orderBy: { createdAt: "desc" },
    include: { campaign: { select: { name: true } }, messages: { orderBy: { deliveredAt: "desc" }, take: 1 } },
  });

  const header = [
    "Nome",
    "Sobrenome",
    "Cargo",
    "Status",
    "Campanha",
    "Etiquetas",
    "Encaixe (0-100)",
    "Follow-ups enviados",
    "Motivo (precisa de você)",
    "Anotações",
    "Perfil",
    "Criado em",
    "Última mensagem em",
  ];
  const rows = leads.map((l) => [
    l.firstName,
    l.lastName,
    l.jobTitle,
    STATUS_LABEL[l.status],
    l.campaign?.name,
    l.tags.join(", "),
    l.icpScore,
    l.followUpsSent,
    l.needsHumanReason,
    l.notes,
    l.linkedinProfileUrl,
    date(l.createdAt),
    date(l.messages[0]?.deliveredAt),
  ]);

  const csv = "﻿" + [header, ...rows].map((r) => r.map(cell).join(";")).join("\r\n");
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="leads-${today}.csv"`,
      "cache-control": "no-store",
    },
  });
}
