import { prisma } from "@/lib/prisma";

export interface DealRow {
  campaign: string;
  proposals: number;
  won: number;
  wonCents: number;
  lost: number;
}

// Resultado comercial no período, por campanha, a partir do histórico (LeadStageEvent kind DEAL).
// Cada pessoa conta uma vez por etapa (proposta e depois ganho contam nas duas, como num funil).
export async function dealBoard(since: Date | null): Promise<{ total: DealRow; byCampaign: DealRow[] }> {
  const events = await prisma.leadStageEvent.findMany({
    where: { kind: "DEAL", toValue: { in: ["PROPOSAL", "WON", "LOST"] }, ...(since ? { createdAt: { gte: since } } : {}) },
    orderBy: { createdAt: "asc" },
    select: { leadId: true, toValue: true, amountCents: true, lead: { select: { campaign: { select: { name: true } } } } },
  });
  const empty = (campaign: string): DealRow => ({ campaign, proposals: 0, won: 0, wonCents: 0, lost: 0 });
  const total = empty("Total");
  const rows = new Map<string, DealRow>();
  // Para cada pessoa e etapa vale o último registro (o valor pode ser corrigido depois).
  const last = new Map<string, (typeof events)[number]>();
  for (const e of events) last.set(`${e.leadId}:${e.toValue}`, e);
  for (const e of last.values()) {
    const name = e.lead.campaign?.name ?? "Sem campanha";
    const row = rows.get(name) ?? empty(name);
    rows.set(name, row);
    for (const r of [row, total]) {
      if (e.toValue === "PROPOSAL") r.proposals++;
      else if (e.toValue === "WON") {
        r.won++;
        r.wonCents += e.amountCents ?? 0;
      } else r.lost++;
    }
  }
  return { total, byCampaign: [...rows.values()].sort((a, b) => b.wonCents - a.wonCents || b.won - a.won || b.proposals - a.proposals) };
}
