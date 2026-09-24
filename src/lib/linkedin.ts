// Monta a URL de busca por pessoas do próprio LinkedIn — de graça, sem depender
// de nenhum serviço terceiro. Sem dependência de servidor: usado no client
// component pra montar o link "Abrir busca no LinkedIn".
export function buildLinkedinSearchUrl(keywords: string): string {
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords.trim())}`;
}

const LINKEDIN_PROFILE_URL = /^https?:\/\/(www\.)?linkedin\.com\/in\/[^\s/?#]+/i;

// Aceita um link do LinkedIn com ou sem barra/parâmetros no final; normaliza
// removendo query string e barra final pra reduzir duplicata ao colar o mesmo
// link duas vezes de formas ligeiramente diferentes.
export function normalizeLinkedinUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!LINKEDIN_PROFILE_URL.test(trimmed)) return null;
  const match = trimmed.match(/^(https?:\/\/(?:www\.)?linkedin\.com\/in\/[^\s/?#]+)/i);
  return match ? match[1] : null;
}
