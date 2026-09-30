import { prisma } from "@/lib/prisma";
import { parseEmail, parsePhone } from "@/lib/contactFields";

// Pega o WhatsApp e o e-mail que o lead escreve na conversa (qualquer canal) e
// preenche a ficha. Sem IA: regra fixa é mais previsível que pedir ao modelo, e
// um número errado aqui vira mensagem pra pessoa errada.

// Celular brasileiro: DDD + 9 + 8 dígitos, com ou sem +55, espaços, pontos, traços
// e parênteses. Fixo (8 dígitos) fica de fora: não tem WhatsApp.
const PHONE_RE = /(?<!\d)(?:\+?\s*55[\s.-]*)?\(?\s*([1-9]\d)\s*\)?[\s.-]*(9\d{4})[\s.-]?(\d{4})(?!\d)/g;
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi;

// Contato de outra pessoa ("fala com o João", "minha assistente"): não é dele.
// Fica com o corretor, pela regra de handoff de indicação.
const THIRD_PARTY_RE =
  /\b(?:assistente|secret[áa]ri[ao]|s[óo]ci[oa]|colega|gerente|contador\w*|indico|indica[çc][ãa]o|indicar)\b|\b(?:fala|fale|falar|procura|procure|procurar)\s+(?:com|c\/)\s+(?:a|o)\s/i;

export interface FoundContacts {
  phones: string[];
  emails: string[];
}

// Citação de resposta ("> texto") e números que já apareceram em mensagens
// nossas (assinatura do corretor citada no e-mail) não são do lead.
function withoutQuotes(text: string): string {
  return text
    .split("\n")
    .filter((line) => !/^\s*>/.test(line))
    .join("\n");
}

export function extractContacts(rawText: string): FoundContacts {
  // CPF e CNPJ têm a mesma cara de número de telefone: tira antes de procurar.
  const text = withoutQuotes(rawText)
    .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, " ")
    .replace(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g, " ");

  const phones = new Set<string>();
  for (const m of text.matchAll(PHONE_RE)) {
    const parsed = parsePhone(`55${m[1]}${m[2]}${m[3]}`);
    if ("phone" in parsed && parsed.phone) phones.add(parsed.phone);
  }

  const emails = new Set<string>();
  for (const m of text.matchAll(EMAIL_RE)) {
    const parsed = parseEmail(m[0].replace(/[.,;:]+$/, ""));
    if ("email" in parsed && parsed.email) emails.add(parsed.email);
  }
  return { phones: [...phones], emails: [...emails] };
}

function today(): string {
  return new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
}

function prettyPhone(phone: string): string {
  const d = phone.replace(/^55/, "");
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : phone;
}

// Mesmo número, escrito com ou sem o 55.
function samePhone(a: string, b: string): boolean {
  return a.replace(/^55/, "") === b.replace(/^55/, "");
}

export interface CaptureResult {
  phone?: string;
  email?: string;
}

// Regras: só preenche campo vazio (nunca sobrescreve o que o corretor digitou);
// mais de um número/e-mail na mesma mensagem é ambíguo e não grava; o que foi
// feito (ou o conflito) fica numa linha "[auto]" nas anotações do corretor.
export async function captureContacts(leadId: string, text: string): Promise<CaptureResult> {
  if (!text.trim() || THIRD_PARTY_RE.test(text)) return {};
  const found = extractContacts(text);
  if (!found.phones.length && !found.emails.length) return {};

  // Lê a ficha agora: várias mensagens da mesma rodada não podem gravar por cima uma da outra.
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true, phone: true, email: true, notes: true } });
  if (!lead) return {};

  // O que nós mesmos já escrevemos (ex.: assinatura com o número do corretor
  // citada na resposta) não é contato do lead.
  const ours = (await prisma.message.findMany({ where: { leadId: lead.id, sender: { not: "LEAD" } }, select: { content: true } }))
    .map((m) => m.content)
    .join("\n");
  const own = extractContacts(ours);
  const phones = found.phones.filter((p) => !own.phones.some((o) => samePhone(o, p)));
  const emails = found.emails.filter((e) => !own.emails.includes(e));

  const data: { phone?: string; email?: string } = {};
  const lines: string[] = [];
  const result: CaptureResult = {};

  if (phones.length === 1) {
    const phone = phones[0];
    if (!lead.phone) {
      data.phone = phone;
      result.phone = phone;
      lines.push(`[auto ${today()}] WhatsApp informado pelo lead na conversa: ${prettyPhone(phone)}`);
    } else if (!samePhone(lead.phone, phone)) {
      lines.push(`[auto ${today()}] O lead citou outro número (${prettyPhone(phone)}); mantive o da ficha (${prettyPhone(lead.phone)}).`);
    }
  }
  if (emails.length === 1) {
    const email = emails[0];
    if (!lead.email) {
      data.email = email;
      result.email = email;
      lines.push(`[auto ${today()}] E-mail informado pelo lead na conversa: ${email}`);
    } else if (lead.email.toLowerCase() !== email) {
      lines.push(`[auto ${today()}] O lead citou outro e-mail (${email}); mantive o da ficha (${lead.email}).`);
    }
  }
  if (!lines.length) return {};

  const notes = [lead.notes?.trim(), ...lines.filter((l) => !lead.notes?.includes(l))].filter(Boolean).join("\n");
  await prisma.lead.update({ where: { id: lead.id }, data: { ...data, notes } });
  return result;
}

// Ingestão nunca pode falhar por causa disso: erro aqui só vai pro log.
export async function captureContactsSafely(leadId: string, text: string): Promise<void> {
  try {
    await captureContacts(leadId, text);
  } catch (err) {
    console.error("Falha ao capturar contato da conversa", leadId, err);
  }
}
