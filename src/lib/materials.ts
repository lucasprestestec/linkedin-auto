import { randomBytes } from "node:crypto";

// Biblioteca de materiais: regras que não dependem de banco nem de tela.

export const MAX_FILE_BYTES = 4 * 1024 * 1024; // abaixo do limite de 4,5 MB de uma requisição na Vercel
export const MAX_TOTAL_BYTES = 150 * 1024 * 1024; // o banco gratuito tem 512 MB; sobra para o resto do sistema
export const MAX_MATERIALS = 100;

// O tipo vem da extensão (nunca do que o navegador diz) e o começo do arquivo precisa bater.
const TYPES: Record<string, { mime: string; inline: boolean; magic: number[] | null }> = {
  pdf: { mime: "application/pdf", inline: true, magic: [0x25, 0x50, 0x44, 0x46] },
  png: { mime: "image/png", inline: true, magic: [0x89, 0x50, 0x4e, 0x47] },
  jpg: { mime: "image/jpeg", inline: true, magic: [0xff, 0xd8, 0xff] },
  jpeg: { mime: "image/jpeg", inline: true, magic: [0xff, 0xd8, 0xff] },
  webp: { mime: "image/webp", inline: true, magic: [0x52, 0x49, 0x46, 0x46] },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", inline: false, magic: [0x50, 0x4b] },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", inline: false, magic: [0x50, 0x4b] },
  pptx: { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", inline: false, magic: [0x50, 0x4b] },
};

export const ACCEPT_ATTR = Object.keys(TYPES).map((e) => `.${e}`).join(",");
export const TYPES_LABEL = "PDF, imagem (PNG, JPG, WebP), Word, Excel ou PowerPoint";

export const extOf = (name: string) => name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";

export type FileCheck = { ok: true; mime: string; inline: boolean; fileName: string } | { ok: false; error: string };

export function checkFile(name: string, bytes: Uint8Array): FileCheck {
  const t = TYPES[extOf(name)];
  if (!t) return { ok: false, error: `Esse tipo de arquivo não é aceito. Use ${TYPES_LABEL}.` };
  if (bytes.length === 0) return { ok: false, error: "O arquivo está vazio." };
  if (bytes.length > MAX_FILE_BYTES) return { ok: false, error: "O arquivo passa de 4 MB. Comprima o PDF ou use um link (Drive, site)." };
  if (t.magic && !t.magic.every((b, i) => bytes[i] === b)) return { ok: false, error: "O conteúdo não confere com o tipo do arquivo. Confira se não está corrompido." };
  const fileName = name.replace(/[^\w.\- ()À-ÿ]/g, "_").slice(-120);
  return { ok: true, mime: t.mime, inline: t.inline, fileName };
}

export const mimeInline = (mime: string) => Object.values(TYPES).some((t) => t.mime === mime && t.inline);

// Só links http(s). Devolve o endereço limpo ou null.
export function parseLink(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (!u.hostname.includes(".")) return null;
    return u.toString().slice(0, 500);
  } catch {
    return null;
  }
}

export const newMaterialToken = () => randomBytes(15).toString("base64url");
export const isMaterialToken = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{16,40}$/.test(v);

// Endereço que o corretor manda: passa pelo sistema (conta as aberturas e deixa desligar o material).
export const materialUrl = (base: string, token: string) => `${base.replace(/\/$/, "")}/m/${token}`;

export const formatSize = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

// Lista curta para a assistente saber o que existe. Sem endereço: ela nunca manda link, só diz que o corretor pode enviar.
export function catalogForPrompt(items: { title: string; whenToUse: string | null }[]): string | null {
  if (items.length === 0) return null;
  const lines = items.slice(0, 12).map((m) => `- "${m.title.slice(0, 80)}"${m.whenToUse ? ` — use quando: ${m.whenToUse.slice(0, 140)}` : ""}`);
  return `MATERIAIS QUE O CORRETOR TEM PARA ENVIAR (você não manda arquivo nem link. Se o assunto pedir, diga que ele pode enviar o material pelo nome exato; nunca invente material fora desta lista):\n${lines.join("\n")}`;
}
