"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { COOKIE_NAME } from "@/lib/auth";

export async function toggleAutomation(): Promise<{ error?: string }> {
  const settings = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } });
  // Ligar exige o nome: é com ele que o assistente se apresenta aos leads.
  if (settings.automationPaused && !settings.ownerName?.trim()) {
    return { error: "Antes de ligar, cadastre o seu nome em Conta → Seu nome. É assim que o assistente vai se apresentar." };
  }
  await prisma.settings.update({
    where: { id: "singleton" },
    data: { automationPaused: !settings.automationPaused },
  });
  revalidatePath("/");
  return {};
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  redirect("/login");
}
