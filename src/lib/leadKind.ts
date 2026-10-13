import type { LeadKind } from "@prisma/client";

export const LEAD_KIND_LABEL: Record<LeadKind, string> = {
  PERSON: "Pessoa física",
  BUSINESS: "Empresa",
  CANDIDATE: "Candidato à equipe",
  PARTNER: "Parceiro / indicador",
};

// Como o tipo entra no contexto da IA (o gancho e quem atende vêm do material).
export const LEAD_KIND_PROMPT: Record<LeadKind, string> = {
  PERSON: "pessoa física (profissional, família)",
  BUSINESS: "empresa (benefícios, saúde, vida em grupo)",
  CANDIDATE: "candidato a trabalhar com o corretor (ex.: preposto), não é cliente",
  PARTNER: "parceiro / indicador (apresenta clientes), não é cliente",
};

export function parseLeadKind(raw: unknown): LeadKind | null {
  const v = String(raw ?? "");
  return v in LEAD_KIND_LABEL ? (v as LeadKind) : null;
}
