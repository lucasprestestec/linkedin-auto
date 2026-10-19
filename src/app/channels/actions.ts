"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { deskcommConfigOf, resetWhatsapp, whatsappPairing, type WhatsappPairing } from "@/lib/deskcomm";

// Regras do canal de e-mail (tela Canais). null em fallbackDays = o assistente
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

// ---------------------------------------------------------------------------
// WhatsApp (Deskcomm)
// ---------------------------------------------------------------------------

async function currentConfig() {
  const s = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" }, select: { deskcommUrl: true, deskcommToken: true, deskcommChannelId: true } });
  return deskcommConfigOf(s);
}

// Estado do número de WhatsApp. withQr=false só olha (não pede QR); true pede o QR
// (e, se a sessão caiu, reinicia só ela). A tela chama de novo a cada poucos segundos.
export async function whatsappPairingState(withQr: boolean): Promise<WhatsappPairing | { state: "error"; message: string }> {
  const cfg = await currentConfig();
  if (!cfg) return { state: "error", message: "O WhatsApp ainda não foi preparado. Fale com o suporte." };
  try {
    return await whatsappPairing(cfg, withQr);
  } catch (err) {
    return { state: "error", message: err instanceof Error ? err.message : "Não foi possível falar com o WhatsApp." };
  }
}

// O cliente desconecta o número ("disconnect") ou troca de número ("switch": desloga e fica
// esperando o QR do novo celular). O canal e as conversas continuam os mesmos.
export async function resetWhatsappNumber(mode: "disconnect" | "switch") {
  const cfg = await currentConfig();
  if (!cfg) return { error: "O WhatsApp ainda não foi preparado. Fale com o suporte." };
  try {
    await resetWhatsapp(cfg, mode === "switch");
    revalidatePath("/settings");
    return { saved: true as const };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Não foi possível agora. Tente de novo em instantes." };
  }
}

export async function updateWhatsappChannel(input: { enabled: boolean; dailyLimit: number }) {
  const dailyLimit = Math.round(input.dailyLimit);
  if (!Number.isFinite(dailyLimit) || dailyLimit < 1 || dailyLimit > 60) return { error: "Limite diário fora do permitido (1 a 60)." };
  await prisma.settings.update({ where: { id: "singleton" }, data: { whatsappChannelEnabled: input.enabled, dailyWhatsappLimit: dailyLimit } });
  revalidatePath("/channels");
  return { saved: true };
}
