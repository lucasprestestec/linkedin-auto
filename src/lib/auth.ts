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

export function isValidSessionToken(token: string | undefined): boolean {
  if (!token) return false;
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
