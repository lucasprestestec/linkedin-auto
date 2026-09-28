import { prisma } from "@/lib/prisma";
import { normalizeLinkedinUrl, type PeopleSearchFilters } from "@/lib/linkedin";

// Busca de pessoas pelo Google ("X-ray"): perfis públicos do LinkedIn que o
// Google indexou, sem entrar no LinkedIn com a conta do corretor (sem risco de
// bloqueio) e sem gastar crédito da edges.run.
//
// A API oficial do Google (Custom Search) não aceita mais cadastros novos, então
// os resultados vêm de um provedor que consulta o Google:
// - SerpApi (SERPAPI_API_KEY) — plano gratuito mensal, sem cartão;
// - Serper (SERPER_API_KEY) — créditos pré-pagos (os primeiros são grátis).
// Em nenhum dos dois há cobrança surpresa: acabou a cota, a busca para. E o
// sistema ainda conta as buscas do mês e para antes (WEB_SEARCH_MONTHLY_LIMIT).

export interface FoundPerson {
  linkedinProfileUrl: string;
  firstName: string;
  lastName: string;
  headline: string | null;
  snippet: string | null;
}

type Provider = "serpapi" | "serper";

function provider(): Provider | null {
  if (process.env.SERPAPI_API_KEY) return "serpapi";
  if (process.env.SERPER_API_KEY) return "serper";
  return null;
}

export function webSearchEnabled(): boolean {
  return provider() !== null;
}

// Plano grátis da SerpApi: 250 buscas/mês. Fica uma folga.
export function monthlyLimit(): number {
  const n = Number(process.env.WEB_SEARCH_MONTHLY_LIMIT);
  return Number.isInteger(n) && n > 0 ? n : 240;
}

function startOfMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export async function searchesLeftThisMonth(): Promise<number> {
  const used = await prisma.webSearchLog.count({ where: { createdAt: { gte: startOfMonth() } } });
  return Math.max(0, monthlyLimit() - used);
}

// Frase com espaço vai entre aspas; vários valores do mesmo filtro viram OU.
function group(values: string[]): string | null {
  const parts = values
    .map((v) => v.trim().replace(/"/g, ""))
    .filter(Boolean)
    .map((v) => (/\s/.test(v) ? `"${v}"` : v));
  if (parts.length === 0) return null;
  return parts.length === 1 ? parts[0] : `(${parts.join(" OR ")})`;
}

export function buildXrayQuery(f: PeopleSearchFilters): string {
  const groups = [f.titles, f.companies, f.locations, f.industries, f.keywords, f.schools, f.firstNames, f.lastNames]
    .map(group)
    .filter((g): g is string => g !== null);
  return ["site:linkedin.com/in", ...groups].join(" ");
}

// "Maria Souza - Diretora de RH - Grupo Vértice | LinkedIn" → nome + headline.
export function parseResult(title: string, link: string, snippet?: string | null): FoundPerson | null {
  const url = normalizeLinkedinUrl(link);
  if (!url) return null;
  const clean = title
    .replace(/\s*[|\-–—]\s*LinkedIn\s*$/i, "")
    .replace(/\s*\.\.\.\s*$/, "")
    .trim();
  const [name, ...rest] = clean.split(/\s+[-–—|]\s+/);
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  const headline = rest.join(" · ").trim() || null;
  return {
    linkedinProfileUrl: url,
    firstName: words[0],
    lastName: words.slice(1).join(" "),
    headline,
    snippet: snippet?.trim().slice(0, 220) || null,
  };
}

interface RawResult {
  title?: string;
  link?: string;
  snippet?: string;
}

async function fetchPage(q: string, page: number): Promise<{ items: RawResult[]; hasMore: boolean }> {
  const which = provider();
  if (which === "serpapi") {
    const params = new URLSearchParams({
      engine: "google",
      q,
      google_domain: "google.com.br",
      gl: "br",
      hl: "pt-br",
      num: "10",
      start: String(page * 10),
      api_key: process.env.SERPAPI_API_KEY!,
    });
    const res = await fetch(`https://serpapi.com/search.json?${params}`, { cache: "no-store" });
    const data = (await res.json().catch(() => ({}))) as { error?: string; organic_results?: RawResult[]; serpapi_pagination?: { next?: string } };
    // "Google hasn't returned any results" é só uma busca vazia, não erro.
    if (data.error && !/hasn't returned any results/i.test(data.error)) throw new Error(`Busca falhou: ${data.error}`);
    if (!res.ok && !data.error) throw new Error(`Busca falhou (HTTP ${res.status}).`);
    return { items: data.organic_results ?? [], hasMore: Boolean(data.serpapi_pagination?.next) };
  }
  if (which === "serper") {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": process.env.SERPER_API_KEY!, "Content-Type": "application/json" },
      body: JSON.stringify({ q, gl: "br", hl: "pt-br", num: 10, page: page + 1 }),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as { message?: string; organic?: RawResult[] };
    if (!res.ok) throw new Error(`Busca falhou: ${data.message ?? `HTTP ${res.status}`}`);
    const items = data.organic ?? [];
    return { items, hasMore: items.length >= 10 };
  }
  throw new Error("Busca de pessoas não configurada.");
}

export async function searchPeopleOnGoogle(
  filters: PeopleSearchFilters,
  page: number,
): Promise<{ people: FoundPerson[]; hasMore: boolean; left: number }> {
  if ((await searchesLeftThisMonth()) <= 0) {
    throw new Error("As buscas gratuitas deste mês acabaram. Elas voltam no dia 1º — até lá, use \"Abrir no LinkedIn\".");
  }
  const q = buildXrayQuery(filters);
  const { items, hasMore } = await fetchPage(q, page);

  const seen = new Set<string>();
  const people: FoundPerson[] = [];
  for (const it of items) {
    if (!it.title || !it.link) continue;
    const p = parseResult(it.title, it.link, it.snippet);
    if (!p || seen.has(p.linkedinProfileUrl)) continue;
    seen.add(p.linkedinProfileUrl);
    people.push(p);
  }

  await prisma.webSearchLog.create({ data: { query: q, page, results: people.length } });
  return { people, hasMore: hasMore && people.length > 0, left: await searchesLeftThisMonth() };
}
