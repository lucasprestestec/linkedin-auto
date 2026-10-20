import { resolveTxt } from "node:dns/promises";
import { prisma } from "@/lib/prisma";

export interface DomainAuth {
  spf: "ok" | "fraco" | "ausente";
  dmarc: "reject" | "quarantine" | "none" | "ausente";
  dkim: boolean; // achou a chave em algum nome comum; false não prova que falta (o nome pode ser outro)
}

export interface BoxHealth {
  address: string;
  domain: string;
  sent30: number;
  sentTotal: number;
  bounces: number;
  blockedBounces: number;
  lastBlockedAt: Date | null;
  lastError: string | null;
  auth: DomainAuth | null; // null = não consegui consultar o DNS agora
}

export interface Advice {
  level: "erro" | "aviso" | "info";
  text: string;
}

const DKIM_SELECTORS = ["google", "default", "selector1", "selector2", "k1", "s1", "mail", "dkim"];

async function txt(name: string): Promise<string[]> {
  const rows = await Promise.race([resolveTxt(name), new Promise<string[][]>((_, no) => setTimeout(() => no(new Error("timeout")), 3000))]);
  return rows.map((r) => r.join(""));
}
const safeTxt = (name: string) => txt(name).catch(() => [] as string[]);

export async function domainAuth(domain: string): Promise<DomainAuth> {
  const [root, dmarcRows, ...dkimRows] = await Promise.all([safeTxt(domain), safeTxt(`_dmarc.${domain}`), ...DKIM_SELECTORS.map((s) => safeTxt(`${s}._domainkey.${domain}`))]);
  const spfRow = root.find((r) => /^v=spf1\b/i.test(r));
  const dmarcRow = dmarcRows.find((r) => /^v=DMARC1\b/i.test(r));
  const policy = dmarcRow?.match(/\bp=(reject|quarantine|none)\b/i)?.[1].toLowerCase() as DomainAuth["dmarc"] | undefined;
  return {
    spf: !spfRow ? "ausente" : /[-~]all\b/i.test(spfRow) ? "ok" : "fraco",
    dmarc: policy ?? "ausente",
    dkim: dkimRows.some((rows) => rows.some((r) => /v=DKIM1|p=/i.test(r))),
  };
}

// Traduz os números em ações claras para quem opera. Devolução: acima de 2% já pede atenção, acima de 5% é grave.
export function adviceFor(h: BoxHealth, now = new Date()): Advice[] {
  const out: Advice[] = [];
  // Servidor de destino bloqueou o envio nos últimos 14 dias: reputação ou autenticação, não endereço ruim.
  if (h.blockedBounces > 0 && h.lastBlockedAt && now.getTime() - h.lastBlockedAt.getTime() < 14 * 86_400_000) {
    out.push({ level: "erro", text: `Servidores de destino bloquearam ${h.blockedBounces} ${h.blockedBounces === 1 ? "envio" : "envios"} (último em ${h.lastBlockedAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}). Não aumente o limite diário; confira SPF, DKIM e DMARC e fale com o suporte.` });
  }
  if (h.lastError) out.push({ level: "erro", text: `A caixa não está conectando: ${h.lastError}. Confira a senha de app e avise o suporte.` });
  const rate = h.sentTotal >= 20 ? h.bounces / h.sentTotal : null;
  if (rate !== null && rate > 0.05) out.push({ level: "erro", text: `${Math.round(rate * 100)}% dos e-mails voltaram. Pare de enviar para listas antigas e confira os endereços antes de importar.` });
  else if (rate !== null && rate > 0.02) out.push({ level: "aviso", text: `${Math.round(rate * 100)}% dos e-mails voltaram. Limpe a lista antes de aumentar o limite diário.` });
  const a = h.auth;
  if (!a) return out;
  if (a.spf === "ausente") out.push({ level: "erro", text: `O domínio ${h.domain} não tem SPF. Sem ele, os e-mails tendem a cair no spam. Peça ao suporte para criar.` });
  else if (a.spf === "fraco") out.push({ level: "aviso", text: `O SPF de ${h.domain} não termina em "~all" ou "-all". Peça ao suporte para revisar.` });
  if (a.dmarc === "ausente") out.push({ level: "aviso", text: `O domínio ${h.domain} não tem DMARC. Gmail e Yahoo exigem de quem envia muito. Peça ao suporte para criar.` });
  else if (a.dmarc === "none") out.push({ level: "info", text: "O DMARC está só observando (p=none). Funciona, mas dá menos proteção à reputação." });
  if (!a.dkim) out.push({ level: "info", text: "Não encontrei a assinatura DKIM nos nomes mais comuns. Se o suporte configurou com outro nome, ignore este aviso." });
  return out;
}

export async function emailHealth(): Promise<BoxHealth[]> {
  const boxes = await prisma.mailbox.findMany({ where: { status: "ACTIVE" }, orderBy: { createdAt: "asc" } });
  const since = new Date(Date.now() - 30 * 86_400_000);
  const sentWhere = (mailboxId: string) => ({ mailboxId, channel: "EMAIL" as const, sender: { in: ["AGENT" as const, "HUMAN" as const] } });
  return Promise.all(
    boxes.map(async (mb) => {
      const domain = mb.address.split("@")[1]?.toLowerCase() ?? "";
      const [sent30, sentTotal, auth] = await Promise.all([
        prisma.message.count({ where: { ...sentWhere(mb.id), createdAt: { gte: since } } }),
        prisma.message.count({ where: sentWhere(mb.id) }),
        domain ? domainAuth(domain).catch(() => null) : Promise.resolve(null),
      ]);
      return { address: mb.address, domain, sent30, sentTotal, bounces: mb.bounces, blockedBounces: mb.blockedBounces, lastBlockedAt: mb.lastBlockedAt, lastError: mb.lastError, auth };
    }),
  );
}
