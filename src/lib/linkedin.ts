// Monta a URL de busca por pessoas do próprio LinkedIn — de graça, sem depender
// de nenhum serviço terceiro. Sem dependência de servidor: usado no client
// component pra montar o link "Abrir busca no LinkedIn".
export function buildLinkedinSearchUrl(keywords: string): string {
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords.trim())}`;
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
