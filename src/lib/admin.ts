import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

// Área de administração (configurações técnicas: IA, limites, horários...).
// Só existe onde ADMIN_PASSWORD estiver definido — sem a variável, /admin dá
// 404. A ideia é defini-la só no .env.local e usar o admin rodando local.

export const ADMIN_COOKIE = "admin_session";

export function adminEnabled(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

// Assinado com a própria senha: trocar ADMIN_PASSWORD invalida as sessões.
function adminToken(): string {
  const secret = process.env.SESSION_SECRET;
  const password = process.env.ADMIN_PASSWORD;
  if (!secret || !password) throw new Error("Admin não configurado.");
  return createHmac("sha256", secret).update(`admin:${password}`).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function checkAdminPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  return Boolean(expected) && safeEqual(password, expected!);
}

export function createAdminToken(): string {
  return adminToken();
}

export async function isAdmin(): Promise<boolean> {
  if (!adminEnabled()) return false;
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  return Boolean(token) && safeEqual(token!, adminToken());
}

// Toda ação do admin chama isto: server actions podem ser chamadas por
// qualquer um logado no painel, então a checagem tem que ser no servidor.
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) throw new Error("Acesso restrito.");
}
