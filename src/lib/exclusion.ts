import { prisma } from "@/lib/prisma";
import { linkedinProfileSlug } from "@/lib/linkedin";

// Lista de exclusão: gente que nunca deve receber convite nem mensagem
// automática (clientes atuais, concorrentes, colegas). Um item por linha:
// - link de perfil do LinkedIn → casa exatamente com aquele perfil;
// - qualquer outro texto → casa com o nome completo (igual) ou aparece no
//   cargo/headline (serve pra empresa: "Porto Seguro" bloqueia quem trabalha lá).

export interface ExclusionRules {
  slugs: Set<string>;
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

export function parseExclusionList(raw: string | null | undefined): ExclusionRules {
  const rules: ExclusionRules = { slugs: new Set(), terms: [] };
  for (const line of (raw ?? "").split("\n")) {
    const item = line.trim();
    if (!item) continue;
    const slug = linkedinProfileSlug(item);
    if (slug) rules.slugs.add(slug);
    // Termos muito curtos casariam com meio mundo ("ana", "rh").
    else if (normalize(item).length >= 3) rules.terms.push(normalize(item));
  }
  return rules;
}

export function isExcluded(target: ExclusionTarget, rules: ExclusionRules): boolean {
  if (target.linkedinProfileUrl) {
    const slug = linkedinProfileSlug(target.linkedinProfileUrl);
    if (slug && rules.slugs.has(slug)) return true;
  }
  if (rules.terms.length === 0) return false;
  const fullName = normalize([target.firstName, target.lastName].filter(Boolean).join(" "));
  const headline = normalize(target.headline ?? "");
  return rules.terms.some((term) => term === fullName || (headline && headline.includes(term)));
}

export async function loadExclusionRules(): Promise<ExclusionRules> {
  const settings = await prisma.settings.findUnique({ where: { id: "singleton" }, select: { exclusionList: true } });
  return parseExclusionList(settings?.exclusionList);
}
