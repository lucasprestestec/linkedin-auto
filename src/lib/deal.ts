import type { DealStage } from "@prisma/client";

// Resultado do negócio depois da reunião (alimenta "quais campanhas geram venda" no painel).
export const DEAL_LABEL: Record<DealStage, string> = {
  HELD: "Reunião aconteceu",
  NO_SHOW: "Faltou",
  PROPOSAL: "Virou proposta",
  WON: "Ganhou",
  LOST: "Perdeu",
};

export function parseDealStage(v: unknown): DealStage | null {
  return typeof v === "string" && Object.hasOwn(DEAL_LABEL, v) ? (v as DealStage) : null;
}

// "1.500,50" ou "1500.5" → centavos. Vazio → null; lixo ou negativo → undefined.
export function parseMoneyCents(raw: string): number | null | undefined {
  const t = raw.replace(/[R$\s]/g, "");
  if (!t) return null;
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) && n >= 0 && n < 1e9 ? Math.round(n * 100) : undefined;
}

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
