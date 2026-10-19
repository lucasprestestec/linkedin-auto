"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { createInviteToken, normalizeLogin } from "@/lib/panelUsers";

export async function addPanelUser(data: { name: string; login: string }): Promise<{ error?: string }> {
  await requireAdmin();
  const name = data.name.trim().slice(0, 80);
  if (!name) return { error: "Informe o nome da pessoa." };
  const login = normalizeLogin(data.login || name.split(/\s+/)[0]);
  if (login.length < 2 || login.length > 40) return { error: "O login precisa ter de 2 a 40 letras ou números." };
  if (await prisma.panelUser.findUnique({ where: { login }, select: { id: true } })) return { error: `O login "${login}" já está em uso. Escolha outro.` };
  await prisma.panelUser.create({ data: { name, login } });
  revalidatePath("/admin/acessos");
  return {};
}

// Gera o link para a pessoa escolher a própria senha (serve também para quem esqueceu: abre o link e troca).
export async function inviteLink(id: string): Promise<{ error?: string; link?: string }> {
  await requireAdmin();
  const user = await prisma.panelUser.findUnique({ where: { id } });
  if (!user) return { error: "Pessoa não encontrada." };
  if (!user.active) return { error: "Reative o acesso antes de gerar o link." };
  const host = (await headers()).get("host");
  const base = process.env.APP_URL?.replace(/\/$/, "") || (host ? `https://${host}` : "");
  return { link: `${base}/convite/${createInviteToken(user.id, user.passwordHash)}` };
}

export async function setPanelUserActive(id: string, active: boolean) {
  await requireAdmin();
  await prisma.panelUser.update({ where: { id }, data: { active } });
  // Desativada: o celular dela para de receber avisos com dados de leads.
  if (!active) await prisma.pushSubscription.deleteMany({ where: { userId: id } });
  revalidatePath("/admin/acessos");
}
