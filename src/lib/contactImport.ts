import type { LeadKind } from "@prisma/client";
import { parseEmail, parsePhone } from "@/lib/contactFields";
import { normalizeLinkedinUrl } from "@/lib/linkedin";

// Leitura de planilha (CSV) de contatos, sem banco e sem rede: as telas e os testes também usam.
// Aceita ponto e vírgula (Excel em português), vírgula ou tab, aspas, e acha as colunas pelo título.

export const MAX_IMPORT_ROWS = 5000;

// RFC 4180 simplificado: aspas duplas, aspas escapadas ("") e quebra de linha dentro de aspas.
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const firstLine = text.split(/\r?\n/).find((l) => l.trim()) ?? "";
  const count = (ch: string) => firstLine.split(ch).length - 1;
  const delimiter = [";", "\t", ","].reduce((best, ch) => (count(ch) > count(best) ? ch : best), ",");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((v) => v.trim())) rows.push(row);
  return rows;
}

type Field = "firstName" | "lastName" | "fullName" | "email" | "phone" | "linkedin" | "company" | "jobTitle" | "referredBy" | "kind" | "personal";

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

const HEADERS: Record<Field, string[]> = {
  firstName: ["primeironome", "firstname", "nome"],
  lastName: ["sobrenome", "lastname", "ultimonome"],
  fullName: ["nomecompleto", "fullname", "name", "contato", "pessoa"],
  email: ["email", "emailcorporativo", "emailprofissional", "correio"],
  phone: ["telefone", "celular", "whatsapp", "fone", "phone", "tel", "telefonecelular"],
  linkedin: ["linkedin", "linkedinurl", "urldolinkedin", "linkedinprofile", "perfildolinkedin", "perfil"],
  company: ["empresa", "company", "organizacao", "organization"],
  jobTitle: ["cargo", "titulo", "funcao", "jobtitle", "title", "position"],
  referredBy: ["indicadopor", "indicador", "referredby", "quemindicou"],
  kind: ["tipo", "kind", "categoria"],
  personal: ["observacoes", "observacao", "obs", "notas", "anotacoes", "personal"],
};

const KIND_WORDS: [RegExp, LeadKind][] = [
  [/^(person|pessoa|pessoafisica|pf|profissional|familia)$/, "PERSON"],
  [/^(business|empresa|pj|pessoajuridica|corporativo)$/, "BUSINESS"],
  [/^(candidate|candidato|preposto|candidatoaequipe)$/, "CANDIDATE"],
  [/^(partner|parceiro|indicador|parceiroindicador)$/, "PARTNER"],
];

export function parseKindWord(raw: string): LeadKind | null {
  const v = norm(raw);
  return KIND_WORDS.find(([re]) => re.test(v))?.[1] ?? null;
}

export interface ImportRow {
  line: number;
  firstName: string;
  lastName: string | null;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  linkedinProfileUrl: string | null;
  referredBy: string | null;
  kind: LeadKind | null;
  personal: string | null;
}

export interface ImportProblem {
  line: number;
  message: string;
}

export interface ParsedImport {
  rows: ImportRow[];
  problems: ImportProblem[];
  // Colunas que não reconheci (ficam de fora).
  ignored: string[];
  // Campos que a planilha traz.
  found: Field[];
  total: number;
  error?: string;
}

// Lê a planilha: devolve as linhas boas e, separadas, os problemas de cada linha ruim (com o número da linha na planilha).
export function readContacts(text: string): ParsedImport {
  const empty = { rows: [], problems: [], ignored: [], found: [], total: 0 };
  const table = parseCsv(text);
  if (table.length < 2) return { ...empty, error: "A planilha precisa de uma linha de títulos e pelo menos um contato." };
  if (table.length - 1 > MAX_IMPORT_ROWS) return { ...empty, error: `A planilha tem mais de ${MAX_IMPORT_ROWS} contatos. Divida em partes menores.` };

  const header = table[0].map(norm);
  const column = new Map<Field, number>();
  for (const [field, names] of Object.entries(HEADERS) as [Field, string[]][]) {
    const i = header.findIndex((h) => names.includes(h));
    if (i >= 0) column.set(field, i);
  }
  // "Nome" sozinho, sem sobrenome: pode ser o nome completo (separa no primeiro espaço).
  const splitName = column.has("firstName") && !column.has("lastName") && !column.has("fullName");
  const used = new Set(column.values());
  const ignored = table[0].filter((h, i) => h.trim() && !used.has(i));
  const found = [...column.keys()];
  if (!column.has("firstName") && !column.has("fullName")) return { ...empty, ignored, found, error: "Não achei a coluna do nome. Use um título como “Nome” ou “Nome completo”." };
  if (!column.has("email") && !column.has("phone") && !column.has("linkedin")) return { ...empty, ignored, found, error: "Não achei nenhuma coluna de contato. Use “E-mail”, “Telefone” ou “LinkedIn”." };

  const get = (r: string[], f: Field) => {
    const i = column.get(f);
    return i === undefined ? "" : (r[i] ?? "").trim();
  };

  const rows: ImportRow[] = [];
  const problems: ImportProblem[] = [];
  const seen = new Map<string, number>();
  table.slice(1).forEach((r, idx) => {
    const line = idx + 2;
    const bad = (message: string) => problems.push({ line, message });

    let firstName = get(r, "firstName");
    let lastName = get(r, "lastName");
    const full = get(r, "fullName");
    if (!firstName && full) firstName = full;
    if (splitName || (!lastName && full && firstName === full)) {
      const [first, ...rest] = firstName.split(/\s+/);
      firstName = first ?? "";
      lastName = rest.join(" ");
    }
    if (!firstName) return bad("Falta o nome.");

    const e = parseEmail(get(r, "email"));
    if ("error" in e) return bad(`E-mail inválido (${get(r, "email")}).`);
    const p = parsePhone(get(r, "phone"));
    if ("error" in p) return bad(`Telefone inválido (${get(r, "phone")}). Use DDD + número.`);
    const rawLinkedin = get(r, "linkedin");
    const linkedin = rawLinkedin ? normalizeLinkedinUrl(rawLinkedin) : null;
    if (rawLinkedin && !linkedin) return bad("Link do LinkedIn inválido.");
    if (!e.email && !p.phone && !linkedin) return bad("Sem e-mail, telefone nem LinkedIn.");

    // Repetido dentro da própria planilha: fica só a primeira.
    for (const key of [e.email && `e:${e.email}`, p.phone && `p:${p.phone}`, linkedin && `l:${linkedin}`]) {
      if (!key) continue;
      const first = seen.get(key);
      if (first) return bad(`Repetido (já está na linha ${first}).`);
      seen.set(key, line);
    }

    const company = get(r, "company");
    const title = get(r, "jobTitle");
    // O sistema guarda "Cargo · Empresa" num campo só; a empresa é lida depois do separador.
    const jobTitle = [title, company].filter(Boolean).join(" · ");
    const kindRaw = get(r, "kind");
    rows.push({
      line,
      firstName: firstName.slice(0, 80),
      lastName: lastName ? lastName.slice(0, 80) : null,
      jobTitle: jobTitle ? jobTitle.slice(0, 200) : null,
      email: e.email,
      phone: p.phone,
      linkedinProfileUrl: linkedin,
      referredBy: get(r, "referredBy").slice(0, 120) || null,
      kind: kindRaw ? parseKindWord(kindRaw) : null,
      personal: get(r, "personal").slice(0, 2000) || null,
    });
  });

  return { rows, problems, ignored, found, total: table.length - 1 };
}
