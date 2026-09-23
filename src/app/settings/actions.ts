"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createIdentity } from "@/lib/edges";

export async function getOrCreateIdentityLoginLink(): Promise<string> {
  const settings = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } });

  if (settings.linkedinIdentityId) {
    // Já existe identidade: não dá para gerar novo link por API para uma
    // identidade existente. Orientamos a reconectar via suporte se necessário.
    throw new Error("ALREADY_HAS_IDENTITY");
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
