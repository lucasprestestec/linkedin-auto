"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

// Regras do canal de e-mail (tela Canais). null em fallbackDays = a secretária
// nunca se apresenta por e-mail quando o convite fica parado.
export async function updateEmailChannel(input: { enabled: boolean; dailyLimit: number; fallbackDays: number | null }) {
  const dailyLimit = Math.round(input.dailyLimit);
  const fallbackDays = input.fallbackDays == null ? null : Math.round(input.fallbackDays);
  if (!Number.isFinite(dailyLimit) || dailyLimit < 1 || dailyLimit > 100) return { error: "Limite diário fora do permitido (1 a 100)." };
  if (fallbackDays != null && (!Number.isFinite(fallbackDays) || fallbackDays < 1 || fallbackDays > 30)) return { error: "Dias fora do permitido (1 a 30)." };
  await prisma.settings.update({
    where: { id: "singleton" },
    data: { emailChannelEnabled: input.enabled, dailyEmailLimit: dailyLimit, emailInviteFallbackDays: fallbackDays },
  });
  revalidatePath("/channels");
  revalidatePath("/settings");
  return { saved: true };
}
