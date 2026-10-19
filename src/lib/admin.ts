import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { getSession } from "@/lib/session";

// Área de administração (configurações técnicas: IA, limites, horários...).
// Só existe onde ADMIN_PASSWORD estiver definido — sem a variável, /admin dá
// 404. A ideia é defini-la só no .env.local e usar o admin rodando local.
//
// Além da senha, /admin só existe para o DONO do sistema: quem tem acesso ao painel mas
// não é o dono (a equipe do cliente) recebe 404, como se a página não existisse. O dono é
// a pessoa do painel com um destes logins; só /admin cria pessoas, então o cliente não
// consegue criar uma com esse login. Enquanto ninguém tem acesso individual (instalação
// nova, só a senha única do painel), quem entra é o próprio instalador: vale como dono.

export const ADMIN_COOKIE = "admin_session";
const OWNER_LOGINS = ["lucas"];

export function adminEnabled(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export async function isOwnerSession(): Promise<boolean> {
  const s = await getSession();
  return s?.kind === "legacy" || (s?.kind === "user" && OWNER_LOGINS.includes(s.user.login));
}

// A página de admin existe? Para quem não é o dono, não.
export async function adminVisible(): Promise<boolean> {
  return adminEnabled() && (await isOwnerSession());
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
  if (!(await adminVisible())) return false;
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  return Boolean(token) && safeEqual(token!, adminToken());
}

// Toda ação do admin chama isto: server actions podem ser chamadas por
// qualquer um logado no painel, então a checagem tem que ser no servidor.
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) throw new Error("Acesso restrito.");
}
