import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { signWith } from "@/lib/auth";

// Acesso individual ao painel: senha guardada só como hash (scrypt) e link de convite assinado.

export const MIN_PASSWORD = 10;

// Logins do suporte (o dono do sistema): a equipe do cliente não vê nem altera estes acessos.
export const OWNER_LOGINS = ["lucas"];

// "Maria Eduarda" -> "maria.eduarda": minúsculas, sem acento, sem espaço. Vale no cadastro e no login.
export function normalizeLogin(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._@-]/g, "");
}
const INVITE_DAYS = 7;

export function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("hex")}$${scryptSync(pw, salt, 64).toString("hex")}`;
}

export function verifyPassword(pw: string, stored: string | null): boolean {
  const [kind, salt, hash] = (stored ?? "").split("$");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const got = scryptSync(pw, Buffer.from(salt, "hex"), expected.length);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

// Impressão digital da senha atual: trocar a senha invalida as sessões e os convites antigos.
export function fingerprint(stored: string | null): string {
  return createHash("sha256").update(stored ?? "sem-senha").digest("hex").slice(0, 10);
}

// Link de convite: vale 7 dias e só até a pessoa escolher a senha (a impressão digital muda).
export function createInviteToken(userId: string, stored: string | null, now = Date.now()): string {
  const body = `${userId}.${now + INVITE_DAYS * 86_400_000}.${fingerprint(stored)}`;
  return `${body}.${signWith(`invite:${body}`)}`;
}

export function readInviteToken(token: string, now = Date.now()): { userId: string; fp: string } | null {
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [userId, exp, fp, sig] = parts;
  const expected = signWith(`invite:${userId}.${exp}.${fp}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (!(Number(exp) > now)) return null;
  return { userId, fp };
}
