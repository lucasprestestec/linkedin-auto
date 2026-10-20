import { resolve4, resolveMx } from "node:dns/promises";

// O domínio do e-mail recebe e-mail? Pega erro de digitação ("gmial.com") e domínio que não existe antes de gastar envio.
// "incerto" (DNS lento ou fora do ar) nunca bloqueia: na dúvida, o endereço vale.
export type DomainStatus = "ok" | "sem_servidor" | "incerto";

export interface DnsLookup {
  mx(domain: string): Promise<{ exchange: string; priority: number }[]>;
  a(domain: string): Promise<string[]>;
}

const real: DnsLookup = { mx: (d) => resolveMx(d), a: (d) => resolve4(d) };
const TIMEOUT_MS = 3000;
// Erros que dizem "não há registro" (diferente de DNS fora do ar ou lento).
const NO_RECORD = new Set(["ENOTFOUND", "ENODATA"]);

const withTimeout = <T,>(p: Promise<T>) => Promise.race([p, new Promise<never>((_, no) => setTimeout(() => no(Object.assign(new Error("timeout"), { code: "ETIMEOUT" })), TIMEOUT_MS))]);
const codeOf = (e: unknown) => (e as { code?: string })?.code ?? "";

export const domainOf = (email: string) => email.split("@")[1]?.trim().toLowerCase() ?? "";

export async function checkEmailDomain(domain: string, dns: DnsLookup = real): Promise<DomainStatus> {
  if (!domain || !domain.includes(".")) return "sem_servidor";
  try {
    const mx = await withTimeout(dns.mx(domain));
    // MX nulo (RFC 7505: "."): o domínio declara que não recebe e-mail.
    if (mx.length > 0) return mx.every((m) => m.exchange === "" || m.exchange === ".") ? "sem_servidor" : "ok";
  } catch (e) {
    if (!NO_RECORD.has(codeOf(e))) return "incerto";
  }
  // Sem MX, o e-mail vai para o endereço do próprio domínio (registro A), se existir.
  try {
    return (await withTimeout(dns.a(domain))).length > 0 ? "ok" : "sem_servidor";
  } catch (e) {
    return NO_RECORD.has(codeOf(e)) ? "sem_servidor" : "incerto";
  }
}

// Vários domínios de uma vez (planilha), poucos por vez para não encher o DNS.
export async function checkEmailDomains(domains: string[], dns: DnsLookup = real): Promise<Map<string, DomainStatus>> {
  const unique = [...new Set(domains.filter(Boolean))];
  const out = new Map<string, DomainStatus>();
  for (let i = 0; i < unique.length; i += 10) {
    await Promise.all(unique.slice(i, i + 10).map(async (d) => out.set(d, await checkEmailDomain(d, dns))));
  }
  return out;
}

export const noMailMessage = (domain: string) => `O domínio ${domain} não recebe e-mail. Confira o endereço.`;
