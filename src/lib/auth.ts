import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "session";

function sign(value: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET não configurado.");
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function createSessionToken(): string {
  return sign("authenticated");
}

// Assina um texto com o segredo do sistema (usado também nos convites de acesso).
export function signWith(value: string): string {
  return sign(value);
}

// Sessão de acesso individual: u.<id da pessoa>.<impressão digital da senha>.<assinatura>.
export function createUserToken(userId: string, fp: string): string {
  const body = `u.${userId}.${fp}`;
  return `${body}.${sign(body)}`;
}

export function parseUserToken(token: string | undefined): { id: string; fp: string } | null {
  const parts = (token ?? "").split(".");
  if (parts.length !== 4 || parts[0] !== "u") return null;
  const a = Buffer.from(parts[3]);
  const b = Buffer.from(sign(`u.${parts[1]}.${parts[2]}`));
  return a.length === b.length && timingSafeEqual(a, b) ? { id: parts[1], fp: parts[2] } : null;
}

// Só confere a assinatura (o proxy não consulta o banco). Quem pode de fato entrar,
// ou se a pessoa foi desativada, é decidido por getSession().
export function isValidSessionToken(token: string | undefined): boolean {
  if (!token) return false;
  if (parseUserToken(token)) return true;
  const expected = createSessionToken();
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function checkPassword(password: string): boolean {
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected) throw new Error("DASHBOARD_PASSWORD não configurado.");
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export { COOKIE_NAME };

// Compara um segredo recebido com o esperado em tempo constante. Sem segredo
// configurado, recusa sempre: antes, com CRON_SECRET ausente, o header
// "Bearer undefined" passava.
export function secretMatches(received: string | null | undefined, expected: string | undefined): boolean {
  if (!expected || !received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isValidBearer(header: string | null, secret: string | undefined): boolean {
  if (!header?.startsWith("Bearer ")) return false;
  return secretMatches(header.slice("Bearer ".length), secret);
}
