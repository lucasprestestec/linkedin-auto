import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

// Áudio gerado pra mandar por WhatsApp. O Deskcomm baixa o arquivo por um endereço público
// (/api/audio/<código>): o código é longo e impossível de adivinhar, e o arquivo some em 24 horas.

const TTL_MS = 24 * 60 * 60 * 1000;

export const textHash = (text: string) => createHash("sha256").update(text.trim()).digest("hex").slice(0, 32);

// Endereço público do sistema (o mesmo APP_URL do rastreio de e-mail). Sem ele não dá pra mandar áudio.
export function publicBaseUrl(): string | null {
  return process.env.APP_URL?.replace(/\/$/, "") || null;
}

export function audioUrl(token: string): string | null {
  const base = publicBaseUrl();
  return base ? `${base}/api/audio/${token}` : null;
}

// Guarda o áudio e devolve o código. Apaga os vencidos de passagem (sem precisar de rotina à parte).
export async function storeOutgoingAudio(bytes: Buffer, mime: string, opts: { draftId?: string | null; text?: string } = {}): Promise<string> {
  await prisma.outgoingAudio.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => {});
  const id = randomBytes(24).toString("base64url");
  await prisma.outgoingAudio.create({
    data: { id, bytes: new Uint8Array(bytes), mime, draftId: opts.draftId ?? null, textHash: opts.text ? textHash(opts.text) : null, expiresAt: new Date(Date.now() + TTL_MS) },
  });
  return id;
}

export async function loadOutgoingAudio(id: string): Promise<{ bytes: Buffer; mime: string } | null> {
  if (!/^[\w-]{20,64}$/.test(id)) return null;
  const row = await prisma.outgoingAudio.findUnique({ where: { id } });
  if (!row || row.expiresAt < new Date()) return null;
  return { bytes: Buffer.from(row.bytes), mime: row.mime };
}

// Áudio já gerado pra este rascunho com este texto (o que o usuário ouviu na aprovação).
export async function findDraftAudio(draftId: string, text: string): Promise<string | null> {
  const row = await prisma.outgoingAudio.findFirst({
    where: { draftId, textHash: textHash(text), expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return row?.id ?? null;
}
