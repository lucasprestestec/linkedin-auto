import { prisma } from "@/lib/prisma";
import { linkedinProfileSlug } from "@/lib/linkedin";

import { parseExclusionLines } from "@/lib/audience";

// Lista de exclusão: gente que nunca deve receber convite nem mensagem
// automática (clientes atuais, concorrentes, colegas). Um item por linha:
// - link de perfil do LinkedIn → casa exatamente com aquele perfil;
// - "Empresa: X" → X aparece no cargo/headline ("Porto Seguro" bloqueia quem trabalha lá);
// - "Pessoa: X" → X é igual ao nome completo;
// - texto sem tipo (listas antigas) → vale como nome e como empresa.

export interface ExclusionRules {
  slugs: Set<string>;
  companies: string[];
  people: string[];
  terms: string[];
}

export interface ExclusionTarget {
  linkedinProfileUrl?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  headline?: string | null;
}

// Minúsculas, sem acento e com espaços simples — "João  SILVA" == "joao silva".
function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

// Termos muito curtos casariam com meio mundo ("ana", "rh").
function usable(items: string[]): string[] {
  return items.map(normalize).filter((t) => t.length >= 3);
}

export function parseExclusionList(raw: string | null | undefined): ExclusionRules {
  const lists = parseExclusionLines(raw);
  const slugs = new Set<string>();
  for (const url of lists.profiles) {
    const slug = linkedinProfileSlug(url);
    if (slug) slugs.add(slug);
  }
  return { slugs, companies: usable(lists.companies), people: usable(lists.people), terms: usable(lists.other) };
}

export function isExcluded(target: ExclusionTarget, rules: ExclusionRules): boolean {
  if (target.linkedinProfileUrl) {
    const slug = linkedinProfileSlug(target.linkedinProfileUrl);
    if (slug && rules.slugs.has(slug)) return true;
  }
  const fullName = normalize([target.firstName, target.lastName].filter(Boolean).join(" "));
  const headline = normalize(target.headline ?? "");
  const isName = (t: string) => t === fullName;
  const inHeadline = (t: string) => Boolean(headline) && headline.includes(t);
  return (
    rules.people.some(isName) || rules.companies.some(inHeadline) || rules.terms.some((t) => isName(t) || inHeadline(t))
  );
}

export async function loadExclusionRules(): Promise<ExclusionRules> {
  const settings = await prisma.settings.findUnique({ where: { id: "singleton" }, select: { exclusionList: true } });
  return parseExclusionList(settings?.exclusionList);
}
