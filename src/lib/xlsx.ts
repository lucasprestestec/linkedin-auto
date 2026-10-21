import { unzipSync, strFromU8 } from "fflate";

// Lê a primeira aba de uma planilha do Excel (.xlsx) e devolve as linhas como texto.
// Roda no navegador, antes de enviar: o servidor continua recebendo só texto (CSV).
// Datas chegam como o número de data do Excel; quem lê as datas (parseRenewalDate) entende esse número.

const decode = (s: string) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

// Texto de um <si> ou <is>: junta os pedaços formatados e ignora a pronúncia (rPh).
const textOf = (xml: string) =>
  [...xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "").matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decode(m[1])).join("");

const colIndex = (ref: string) => {
  let n = 0;
  for (const ch of ref.replace(/[^A-Za-z]/g, "").toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
};

// 5.1999990000E10 → 51999990000
const plainNumber = (v: string) => (/^-?\d+(\.\d+)?[eE][+-]?\d+$/.test(v) ? String(Number(v)) : v);

export function readXlsx(bytes: Uint8Array): string[][] {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error("Não consegui abrir esse arquivo. Ele é mesmo uma planilha .xlsx? Se for .xls antigo, abra no Excel e use “Salvar como” .xlsx ou CSV.");
  }
  const text = (name: string) => (files[name] ? strFromU8(files[name]) : null);

  // Primeira aba pela ordem do workbook; sem isso, a primeira da pasta.
  let sheetPath = Object.keys(files).filter((n) => /^xl\/worksheets\/[^/]+\.xml$/.test(n)).sort()[0];
  const wb = text("xl/workbook.xml");
  const rels = text("xl/_rels/workbook.xml.rels");
  const rid = wb?.match(/<sheet\b[^>]*\br:id="([^"]+)"/)?.[1];
  const target = rid && rels ? [...rels.matchAll(/<Relationship\b[^>]*>/g)].map((m) => m[0]).find((t) => t.includes(`Id="${rid}"`))?.match(/Target="([^"]+)"/)?.[1] : null;
  if (target) sheetPath = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
  const sheet = sheetPath && text(sheetPath);
  if (!sheet) throw new Error("A planilha está vazia ou em um formato que não reconheço. Salve como .xlsx ou CSV.");

  const shared = [...(text("xl/sharedStrings.xml") ?? "").matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]));

  const rows: string[][] = [];
  for (const rowMatch of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = [];
    let next = 0;
    for (const c of rowMatch[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1];
      const body = c[2] ?? "";
      const ref = attrs.match(/\br="([^"]+)"/)?.[1];
      const idx = ref ? colIndex(ref) : next;
      const type = attrs.match(/\bt="([^"]+)"/)?.[1];
      const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
      let value = "";
      if (type === "s") value = shared[+v] ?? "";
      else if (type === "inlineStr") value = textOf(body);
      else if (type === "b") value = v === "1" ? "Sim" : "Não";
      else if (type === "str" || type === "e") value = decode(v);
      else value = plainNumber(v);
      row[idx] = value;
      next = idx + 1;
    }
    if (row.some((x) => x && x.trim())) rows.push(Array.from(row, (x) => x ?? ""));
  }
  return rows;
}

// Linhas → texto CSV com ponto e vírgula (o leitor de contatos reconhece sozinho).
export const rowsToCsv = (rows: string[][]) =>
  rows.map((r) => r.map((c) => (/[;"\r\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(";")).join("\n");
