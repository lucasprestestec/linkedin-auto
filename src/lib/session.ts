import { cookies } from "next/headers";
import { COOKIE_NAME, isValidSessionToken, parseUserToken } from "@/lib/auth";
import { fingerprint } from "@/lib/panelUsers";
import { prisma } from "@/lib/prisma";

export type Session = { kind: "legacy" } | { kind: "user"; user: { id: string; name: string; login: string } };

// Já existe alguém com senha própria? Daí em diante a senha única deixa de valer.
export async function hasIndividualAccess(): Promise<boolean> {
  return (await prisma.panelUser.count({ where: { passwordHash: { not: null } } })) > 0;
}

// Quem está logado, conferido no banco: pessoa desativada ou com senha trocada perde a sessão.
export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!isValidSessionToken(token)) return null;
  const parsed = parseUserToken(token);
  if (parsed) {
    const user = await prisma.panelUser.findUnique({ where: { id: parsed.id } });
    if (!user || !user.active || fingerprint(user.passwordHash) !== parsed.fp) return null;
    return { kind: "user", user: { id: user.id, name: user.name, login: user.login } };
  }
  return (await hasIndividualAccess()) ? null : { kind: "legacy" };
}

// As ações de servidor aceitam POST direto (não só pela tela). O proxy.ts já barra quem não
// entrou, mas a documentação do Next pede conferir de novo dentro de cada ação.
export async function requireSession(): Promise<void> {
  if (!(await getSession())) throw new Error("Sessão expirada. Entre de novo.");
}

export async function startSession(token: string): Promise<void> {
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}
