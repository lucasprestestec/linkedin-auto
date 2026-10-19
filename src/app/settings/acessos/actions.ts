"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getSession, requireSession } from "@/lib/session";
import { OWNER_LOGINS, createInviteToken, normalizeLogin } from "@/lib/panelUsers";

// O acesso do suporte e o da própria pessoa não podem ser desativados por aqui.
async function manageable(id: string): Promise<{ error: string } | null> {
  const user = await prisma.panelUser.findUnique({ where: { id }, select: { login: true } });
  if (!user) return { error: "Pessoa não encontrada." };
  if (OWNER_LOGINS.includes(user.login)) return { error: "Este acesso é do suporte e não pode ser alterado." };
  return null;
}

export async function addPanelUser(data: { name: string; login: string }): Promise<{ error?: string }> {
  await requireSession();
  const name = data.name.trim().slice(0, 80);
  if (!name) return { error: "Informe o nome da pessoa." };
  const login = normalizeLogin(data.login || name.split(/\s+/)[0]);
  if (login.length < 2 || login.length > 40) return { error: "O login precisa ter de 2 a 40 letras ou números." };
  if (OWNER_LOGINS.includes(login) || (await prisma.panelUser.findUnique({ where: { login }, select: { id: true } }))) {
    return { error: `O login "${login}" já está em uso. Escolha outro.` };
  }
  await prisma.panelUser.create({ data: { name, login } });
  revalidatePath("/settings/acessos");
  return {};
}

// Gera o link para a pessoa escolher a própria senha (serve também para quem esqueceu: abre o link e troca).
export async function inviteLink(id: string): Promise<{ error?: string; link?: string }> {
  await requireSession();
  const blocked = await manageable(id);
  if (blocked) return blocked;
  const user = await prisma.panelUser.findUnique({ where: { id } });
  if (!user) return { error: "Pessoa não encontrada." };
  if (!user.active) return { error: "Reative o acesso antes de gerar o link." };
  const host = (await headers()).get("host");
  const base = process.env.APP_URL?.replace(/\/$/, "") || (host ? `https://${host}` : "");
  return { link: `${base}/convite/${createInviteToken(user.id, user.passwordHash)}` };
}

export async function setPanelUserActive(id: string, active: boolean): Promise<{ error?: string }> {
  await requireSession();
  const blocked = await manageable(id);
  if (blocked) return blocked;
  const session = await getSession();
  if (!active && session?.kind === "user" && session.user.id === id) return { error: "Você não pode desativar o seu próprio acesso." };
  await prisma.panelUser.update({ where: { id }, data: { active } });
  // Desativada: o celular dela para de receber avisos com dados de leads.
  if (!active) await prisma.pushSubscription.deleteMany({ where: { userId: id } });
  revalidatePath("/settings/acessos");
  return {};
}
