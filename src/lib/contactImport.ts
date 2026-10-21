import type { LeadKind } from "@prisma/client";
import { parseEmail, parsePhone } from "@/lib/contactFields";
import { normalizeLinkedinUrl } from "@/lib/linkedin";
import { parseRenewalDate } from "@/lib/renewal";

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

export type Field =
  | "firstName" | "lastName" | "fullName" | "email" | "phone" | "linkedin" | "company" | "jobTitle" | "referredBy" | "kind" | "personal"
  | "renewal" | "product" | "insurer" | "policy" | "premium";

// Nome de cada campo na tela de importação (o corretor pode corrigir a coluna escolhida).
export const FIELD_LABEL: Record<Field, string> = {
  firstName: "Nome",
  lastName: "Sobrenome",
  fullName: "Nome completo",
  email: "E-mail",
  phone: "Telefone / WhatsApp",
  linkedin: "LinkedIn",
  company: "Empresa",
  jobTitle: "Cargo",
  referredBy: "Indicado por",
  kind: "Tipo",
  personal: "Observações",
  renewal: "Vencimento / renovação",
  product: "Produto (seguro, plano, ramo)",
  insurer: "Seguradora / operadora",
  policy: "Apólice / contrato",
  premium: "Valor / prêmio",
};
export const FIELDS = Object.keys(FIELD_LABEL) as Field[];
// Quem traz um destes campos é carteira de clientes (entra com a etiqueta "cliente").
export const CLIENT_FIELDS: Field[] = ["renewal", "product", "insurer", "policy", "premium"];

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
  renewal: ["vencimento", "renovacao", "datarenovacao", "dataderenovacao", "datavencimento", "datadevencimento", "vencimentoapolice", "fimvigencia", "fimdavigencia", "finalvigencia", "finaldavigencia", "vigenciafinal", "vigenciafim", "terminovigencia", "termino", "validade", "venc", "dtvenc", "dtvencimento", "proximarenovacao", "datafim", "vigencia", "datavigencia"],
  product: ["produto", "ramo", "seguro", "tipodeseguro", "tiposeguro", "plano", "cobertura", "modalidade"],
  insurer: ["seguradora", "operadora", "cia", "companhia", "fornecedor"],
  policy: ["apolice", "numeroapolice", "napolice", "numerodaapolice", "proposta", "contrato"],
  premium: ["premio", "premiototal", "premioliquido", "valor", "mensalidade", "valormensal"],
};

// Segunda tentativa, para títulos que não são idênticos aos de cima ("Data de Vencimento da Apólice"). Vale a ordem.
const HINTS: [Field, RegExp][] = [
  ["email", /mail/],
  ["linkedin", /linkedin/],
  ["phone", /fone|celular|whats|^tel/],
  ["renewal", /venc|renov|fimvig|finalvig|vigenciafinal|vigenciafim|termino|validade/],
  ["insurer", /seguradora|operadora|companhia|^cia/],
  ["policy", /apolice|proposta/],
  ["premium", /premio|mensalidade|valor/],
  ["product", /produto|ramo|seguro|plano|cobertura/],
  ["jobTitle", /cargo|funcao/],
  ["company", /empresa|organiza/],
  ["fullName", /^nome|segurado|cliente|razaosocial|titular/],
];

// Acha a coluna de cada campo pelo título. Devolve índice da coluna → campo.
function autoMap(header: string[]): Map<number, Field> {
  const byField = new Map<Field, number>();
  for (const [field, names] of Object.entries(HEADERS) as [Field, string[]][]) {
    const i = header.findIndex((h) => names.includes(h));
    if (i >= 0) byField.set(field, i);
  }
  for (const [field, re] of HINTS) {
    if (byField.has(field)) continue;
    const used = new Set(byField.values());
    const i = header.findIndex((h, idx) => h && !used.has(idx) && re.test(h));
    if (i >= 0) byField.set(field, i);
  }
  return new Map([...byField].map(([f, i]) => [i, f]));
}

// Procura a linha de títulos nas 10 primeiras (planilhas costumam ter um título ou logo no topo).
function headerRow(table: string[][]): number {
  let best = 0;
  let bestScore = -1;
  table.slice(0, 10).forEach((r, i) => {
    const score = autoMap(r.map(norm)).size;
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  });
  return best;
}

export interface Detected {
  headers: string[];
  // Campo que achei em cada coluna ("" = não usar).
  mapping: (Field | "")[];
  // Primeiras linhas de dados, para o corretor conferir.
  sample: string[][];
}

// Mostra o que entendi de cada coluna, antes de importar.
export function detectColumns(text: string): Detected | null {
  const table = parseCsv(text);
  if (table.length < 2) return null;
  const at = headerRow(table);
  const headers = table[at];
  const auto = autoMap(headers.map(norm));
  return { headers, mapping: headers.map((_, i) => auto.get(i) ?? ""), sample: table.slice(at + 1, at + 4) };
}

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
  // Carteira de clientes: vencimento ("AAAA-MM-DD"), dados do contrato em uma linha e se a planilha é de clientes.
  renewalAt: string | null;
  renewalNote: string | null;
  client: boolean;
}

export interface ImportProblem {
  line: number;
  message: string;
}

export interface ParsedImport {
  rows: ImportRow[];
  problems: ImportProblem[];
  // Avisos de linhas que entram mesmo assim (ex.: vencimento que não entendi).
  warnings: ImportProblem[];
  // A planilha traz colunas de carteira (vencimento, produto...).
  hasClientData: boolean;
  // Colunas que não reconheci (ficam de fora).
  ignored: string[];
  // Campos que a planilha traz.
  found: Field[];
  total: number;
  error?: string;
}

// Lê a planilha: devolve as linhas boas e, separadas, os problemas de cada linha ruim (com o número da linha na planilha).
// `mapping` (opcional) é a escolha do corretor para cada coluna; sem ele, as colunas são achadas pelo título.
export function readContacts(text: string, mapping?: (Field | "")[], now = new Date()): ParsedImport {
  const empty = { rows: [], problems: [], warnings: [], hasClientData: false, ignored: [], found: [], total: 0 };
  const all = parseCsv(text);
  const table = all.slice(all.length > 1 ? headerRow(all) : 0);
  if (table.length < 2) return { ...empty, error: "A planilha precisa de uma linha de títulos e pelo menos um contato." };
  if (table.length - 1 > MAX_IMPORT_ROWS) return { ...empty, error: `A planilha tem mais de ${MAX_IMPORT_ROWS} contatos. Divida em partes menores.` };

  const column = new Map<Field, number>();
  const chosen = mapping ? new Map(mapping.flatMap((f, i): [number, Field][] => (f ? [[i, f]] : []))) : autoMap(table[0].map(norm));
  for (const [i, f] of chosen) if (!column.has(f)) column.set(f, i);
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
  const warnings: ImportProblem[] = [];
  const hasClientData = CLIENT_FIELDS.some((f) => column.has(f));
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

    // Carteira: vencimento e dados do contrato. Vencimento ilegível não barra a linha; vai o aviso.
    const renewalRaw = get(r, "renewal");
    const renewalAt = renewalRaw ? parseRenewalDate(renewalRaw, now) : null;
    if (renewalRaw && !renewalAt) warnings.push({ line, message: `Não entendi o vencimento (${renewalRaw.slice(0, 30)}). Importei sem a data.` });
    const premium = get(r, "premium");
    const policy = get(r, "policy");
    const renewalNote = [get(r, "product"), get(r, "insurer"), policy && `apólice ${policy}`, premium && `valor ${premium}`].filter(Boolean).join(" · ").slice(0, 300) || null;
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
      renewalAt,
      renewalNote,
      client: hasClientData,
    });
  });

  return { rows, problems, warnings, hasClientData, ignored, found, total: table.length - 1 };
}
