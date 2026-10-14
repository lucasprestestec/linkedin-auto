"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { parseEmail } from "@/lib/contactFields";
import { createInviteToken } from "@/lib/panelUsers";

export async function addPanelUser(data: { name: string; email: string }): Promise<{ error?: string }> {
  await requireAdmin();
  const name = data.name.trim().slice(0, 80);
  if (!name) return { error: "Informe o nome da pessoa." };
  const e = parseEmail(data.email);
  if ("error" in e) return { error: e.error };
  if (!e.email) return { error: "Informe o e-mail da pessoa." };
  if (await prisma.panelUser.findUnique({ where: { email: e.email }, select: { id: true } })) return { error: "Esse e-mail já tem acesso." };
  await prisma.panelUser.create({ data: { name, email: e.email } });
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
  revalidatePath("/admin/acessos");
}
