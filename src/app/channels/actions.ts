"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { deskcommConfigOf, inspectDeskcomm, normalizeDeskcommUrl, saveDeskcommConnection } from "@/lib/deskcomm";

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

// ---------------------------------------------------------------------------
// WhatsApp (Deskcomm)
// ---------------------------------------------------------------------------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Confere endereço + token no Deskcomm e grava. O canal (número) é descoberto
// por uma conversa existente, ou informado à mão.
export async function connectDeskcomm(input: { url: string; token: string; channelId?: string }) {
  const current = await currentConfig();
  const url = input.url.trim() ? normalizeDeskcommUrl(input.url) : (current?.url ?? null);
  if (!url) return { error: "Endereço inválido. Ex.: https://xxxx.trycloudflare.com" };
  const token = input.token.trim() || current?.token;
  if (!token) return { error: "Cole o token de API do Deskcomm (começa com dsk_)." };
  const manual = input.channelId?.trim() || null;
  if (manual && !UUID.test(manual)) return { error: "O ID do canal tem o formato 8-4-4-4-12 (ex.: 3f2a…)." };
  try {
    const found = await inspectDeskcomm({ url, token });
    if (found.missingTools.length) return { error: `O token não dá acesso a: ${found.missingTools.join(", ")}. Marque os escopos de MCP (ler e agir) e "gerente".` };
    const channelId = manual ?? found.channelId ?? current?.channelId ?? null;
    await saveDeskcommConnection(url, token, channelId);
    revalidatePath("/channels");
    revalidatePath("/settings");
    return { saved: true, channelDetected: Boolean(channelId) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Não foi possível conectar." };
  }
}

async function currentConfig() {
  const s = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" }, select: { deskcommUrl: true, deskcommToken: true, deskcommChannelId: true } });
  return deskcommConfigOf(s);
}

export async function disconnectDeskcomm() {
  await prisma.settings.update({ where: { id: "singleton" }, data: { deskcommUrl: null, deskcommToken: null, deskcommChannelId: null } });
  revalidatePath("/channels");
  revalidatePath("/settings");
}

export async function updateWhatsappChannel(input: { enabled: boolean; dailyLimit: number }) {
  const dailyLimit = Math.round(input.dailyLimit);
  if (!Number.isFinite(dailyLimit) || dailyLimit < 1 || dailyLimit > 60) return { error: "Limite diário fora do permitido (1 a 60)." };
  await prisma.settings.update({ where: { id: "singleton" }, data: { whatsappChannelEnabled: input.enabled, dailyWhatsappLimit: dailyLimit } });
  revalidatePath("/channels");
  return { saved: true };
}
