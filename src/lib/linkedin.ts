// Busca de pessoas no próprio LinkedIn — de graça, sem serviço terceiro. Cada
// filtro vai pro campo equivalente da busca do LinkedIn (os mesmos do painel
// "Todos os filtros"). Sem dependência de servidor: roda no navegador.

export interface PeopleSearchFilters {
  titles: string[];
  locations: string[];
  companies: string[];
  industries: string[];
  keywords: string[];
  firstNames: string[];
  lastNames: string[];
  schools: string[];
  // Só 2º e 3º grau: 1º grau já é conexão e não pode receber convite.
  onlyNotConnected: boolean;
}

export const EMPTY_SEARCH: PeopleSearchFilters = {
  titles: [],
  locations: [],
  companies: [],
  industries: [],
  keywords: [],
  firstNames: [],
  lastNames: [],
  schools: [],
  onlyNotConnected: true,
};

// Vários valores no mesmo filtro = qualquer um deles: "Diretor de RH" OR CFO.
// Frases vão entre aspas pro LinkedIn não misturar as palavras.
function anyOf(values: string[]): string {
  return values
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) => (/\s/.test(v) ? `"${v.replace(/"/g, "")}"` : v))
    .join(" OR ");
}

export function hasAnyFilter(f: PeopleSearchFilters): boolean {
  return [f.titles, f.locations, f.companies, f.industries, f.keywords, f.firstNames, f.lastNames, f.schools].some((v) => v.length > 0);
}

export function buildLinkedinSearchUrl(f: PeopleSearchFilters): string {
  const params = new URLSearchParams();
  // Cidade e setor não têm campo de texto livre na URL (o LinkedIn filtra por
  // lista própria de regiões/setores), então entram como palavras-chave.
  const keywordGroups = [f.keywords, f.locations, f.industries].filter((g) => g.length > 0).map(anyOf);
  const keywords = keywordGroups.map((g) => (keywordGroups.length > 1 && g.includes(" OR ") ? `(${g})` : g)).join(" ");
  if (keywords) params.set("keywords", keywords);
  if (f.titles.length) params.set("titleFreeText", anyOf(f.titles));
  if (f.companies.length) params.set("company", anyOf(f.companies));
  if (f.firstNames.length) params.set("firstName", anyOf(f.firstNames));
  if (f.lastNames.length) params.set("lastName", anyOf(f.lastNames));
  if (f.schools.length) params.set("schoolFreeText", anyOf(f.schools));
  if (f.onlyNotConnected) params.set("network", JSON.stringify(["S", "O"]));
  params.set("origin", "FACETED_SEARCH");
  return `https://www.linkedin.com/search/results/people/?${params.toString()}`;
}

const LINKEDIN_PROFILE_URL = /^https?:\/\/(?:[a-z]{2,3}\.|www\.)?linkedin\.com\/in\/([^\s/?#]+)/i;

// Identificador do perfil: o trecho depois de /in/, decodificado e em minúsculas.
// É o que dá pra comparar entre fontes diferentes (link colado pelo corretor,
// callback do convite, conversa extraída pela edges.run), que variam em
// www/subdomínio, barra final, query string e caixa.
export function linkedinProfileSlug(raw: string): string | null {
  const match = raw.trim().match(LINKEDIN_PROFILE_URL);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]).toLowerCase();
  } catch {
    return match[1].toLowerCase();
  }
}

// Forma canônica gravada no banco: https://www.linkedin.com/in/<slug>. Assim o
// mesmo perfil colado de jeitos ligeiramente diferentes não vira duas entradas.
export function normalizeLinkedinUrl(raw: string): string | null {
  const slug = linkedinProfileSlug(raw);
  return slug ? `https://www.linkedin.com/in/${encodeURIComponent(slug)}` : null;
}
