"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createIdentity, deleteIdentity, getIdentity } from "@/lib/edges";

export async function getOrCreateIdentityLoginLink(): Promise<string> {
  const settings = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } });

  if (settings.linkedinIdentityId) {
    // A Edges só devolve o link de login no momento da criação. Se já existe
    // uma identidade mas ela nunca chegou a conectar (usuário fechou a aba,
    // por exemplo), apaga essa e cria outra para gerar um link novo — evita
    // acumular identidades órfãs (cada uma tem custo mensal).
    const existing = await getIdentity(settings.linkedinIdentityId).catch(() => null);
    if (existing?.integrations.includes("linkedin")) {
      throw new Error("Essa conta já está conectada.");
    }
    await deleteIdentity(settings.linkedinIdentityId).catch(() => {});
  }

  const identity = await createIdentity("Cliente", "America/Sao_Paulo");
  await prisma.settings.update({
    where: { id: "singleton" },
    data: { linkedinIdentityId: identity.uid },
  });

  const link = identity.identity_login_links?.linkedin;
  if (!link) throw new Error("A Edges não retornou o link de conexão.");

  revalidatePath("/settings");
  return link;
}

export async function updateLimits(_prevState: unknown, formData: FormData) {
  const dailyInviteLimit = Number(formData.get("dailyInviteLimit"));
  const dailyMessageLimit = Number(formData.get("dailyMessageLimit"));

  if (!Number.isFinite(dailyInviteLimit) || !Number.isFinite(dailyMessageLimit) || dailyInviteLimit < 1 || dailyMessageLimit < 1) {
    return { error: "Valores inválidos." };
  }

  await prisma.settings.update({
    where: { id: "singleton" },
    data: { dailyInviteLimit, dailyMessageLimit },
  });

  revalidatePath("/settings");
  return { error: undefined, saved: true };
}
