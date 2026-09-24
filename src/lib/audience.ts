import { linkedinProfileSlug } from "@/lib/linkedin";

// Cliente ideal e lista de exclusão são guardados como texto (colunas que já
// existem em Settings), mas editados em campos separados. Este arquivo converte
// nos dois sentidos e roda tanto no servidor quanto no navegador.

// ---------------------------------------------------------------------------
// Cliente ideal
// ---------------------------------------------------------------------------

export interface IdealClient {
  titles: string[];
  industries: string[];
  sizes: string[];
  regions: string[];
  avoid: string[];
  notes: string;
}

export const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-1000", "1000+"] as const;

export const EMPTY_IDEAL_CLIENT: IdealClient = { titles: [], industries: [], sizes: [], regions: [], avoid: [], notes: "" };

// Rótulo de cada linha. É texto que a IA lê direto, então fica em português claro.
const ICP_LABELS: [Exclude<keyof IdealClient, "notes">, string][] = [
  ["titles", "Cargos"],
  ["industries", "Setores"],
  ["sizes", "Tamanho da empresa (funcionários)"],
  ["regions", "Região"],
  ["avoid", "Evitar"],
];
const NOTES_LABEL = "Observações";

function splitList(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of text.split(";")) {
    const v = part.trim().replace(/\s+/g, " ");
    if (v && !seen.has(v.toLowerCase())) {
      seen.add(v.toLowerCase());
      out.push(v);
    }
  }
  return out;
}

export function serializeIdealClient(icp: IdealClient): string {
  const lines: string[] = [];
  for (const [key, label] of ICP_LABELS) {
    if (icp[key].length) lines.push(`${label}: ${icp[key].map((v) => v.replace(/;/g, ",")).join("; ")}`);
  }
  if (icp.notes.trim()) lines.push(`${NOTES_LABEL}: ${icp.notes.trim()}`);
  return lines.join("\n");
}

// Texto antigo, escrito à mão sem rótulos, vira "Observações" — nada se perde.
export function parseIdealClient(raw: string | null | undefined): IdealClient {
  const icp: IdealClient = { titles: [], industries: [], sizes: [], regions: [], avoid: [], notes: "" };
  const notes: string[] = [];
  let inNotes = false;
  for (const line of (raw ?? "").split("\n")) {
    if (inNotes) {
      notes.push(line);
      continue;
    }
    const match = /^([^:]+):\s*(.*)$/.exec(line.trim());
    const label = match?.[1].trim().toLowerCase();
    const field = ICP_LABELS.find(([, l]) => l.toLowerCase() === label);
    if (match && field) {
      icp[field[0]] = splitList(match[2]);
    } else if (match && label === NOTES_LABEL.toLowerCase()) {
      inNotes = true;
      notes.push(match[2]);
    } else {
      notes.push(line);
    }
  }
  icp.sizes = icp.sizes.filter((s) => (COMPANY_SIZES as readonly string[]).includes(s));
  icp.notes = notes.join("\n").trim();
  return icp;
}

// ---------------------------------------------------------------------------
// Lista de exclusão
// ---------------------------------------------------------------------------

export interface ExclusionLists {
  companies: string[];
  people: string[];
  profiles: string[];
  // Linhas antigas sem tipo: valem como nome e como empresa ao mesmo tempo.
  other: string[];
}

export const EMPTY_EXCLUSION: ExclusionLists = { companies: [], people: [], profiles: [], other: [] };

const COMPANY_PREFIX = "empresa:";
const PERSON_PREFIX = "pessoa:";

export function parseExclusionLines(raw: string | null | undefined): ExclusionLists {
  const lists: ExclusionLists = { companies: [], people: [], profiles: [], other: [] };
  for (const line of (raw ?? "").split("\n")) {
    const item = line.trim();
    if (!item) continue;
    const lower = item.toLowerCase();
    if (lower.startsWith(COMPANY_PREFIX)) {
      const v = item.slice(COMPANY_PREFIX.length).trim();
      if (v) lists.companies.push(v);
    } else if (lower.startsWith(PERSON_PREFIX)) {
      const v = item.slice(PERSON_PREFIX.length).trim();
      if (v) lists.people.push(v);
    } else if (linkedinProfileSlug(item)) {
      lists.profiles.push(item);
    } else {
      lists.other.push(item);
    }
  }
  return lists;
}

export function serializeExclusionLines(lists: ExclusionLists): string {
  return [
    ...lists.companies.map((c) => `Empresa: ${c}`),
    ...lists.people.map((p) => `Pessoa: ${p}`),
    ...lists.profiles,
    ...lists.other,
  ].join("\n");
}
