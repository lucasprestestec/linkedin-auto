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

// Tudo vai no campo "keywords" da busca. Os parâmetros de texto por campo
// (titleFreeText, company, firstName...) o LinkedIn descarta ao abrir o link —
// a busca voltava sem filtro nenhum. "keywords" funciona em qualquer conta
// (grátis ou paga) e aceita OR e parênteses: cada filtro vira um grupo
// "(a OR b)" e os grupos se somam (E).
export function buildLinkedinSearchUrl(f: PeopleSearchFilters): string {
  const params = new URLSearchParams();
  const groups = [f.titles, f.companies, f.locations, f.industries, f.keywords, f.schools, f.firstNames, f.lastNames]
    .filter((g) => g.some((v) => v.trim()))
    .map((g) => {
      const any = anyOf(g);
      return any.includes(" OR ") ? `(${any})` : any;
    });
  if (groups.length) params.set("keywords", groups.join(" "));
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
