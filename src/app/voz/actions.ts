"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { deleteVoice, VoiceError } from "@/lib/voice/fish";
import { ensureAudio } from "@/lib/voice/send";
import { parseVoiceSettings, type AudioMode } from "@/lib/voice/settings";

async function current() {
  const s = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" }, select: { voiceSettings: true, ownerName: true } });
  return { voice: parseVoiceSettings(s.voiceSettings), ownerName: s.ownerName?.trim() || null };
}

async function save(voice: ReturnType<typeof parseVoiceSettings>) {
  await prisma.settings.update({ where: { id: "singleton" }, data: { voiceSettings: voice as unknown as Prisma.InputJsonValue } });
  revalidatePath("/settings");
  revalidatePath("/voz");
}

// Quando o assistente responde em áudio (escolha pessoal do usuário).
export async function setAudioMode(mode: AudioMode): Promise<{ error?: string }> {
  await requireSession();
  if (mode !== "off" && mode !== "mirror" && mode !== "always") return { error: "Opção inválida." };
  const { voice } = await current();
  if (mode !== "off" && !voice.voiceId) return { error: "Crie a sua voz antes de ligar as mensagens de voz." };
  await save({ ...voice, mode });
  return {};
}

// Ouvir a própria voz falando uma frase de exemplo (o áudio fica no ar por 24 h, como os demais).
export async function previewMyVoice(): Promise<{ url?: string; error?: string }> {
  await requireSession();
  const { ownerName } = await current();
  const text = `Oi, tudo bem? ${ownerName ? `Aqui é ${ownerName}. ` : ""}Recebi a sua mensagem e já te respondo com calma. Qualquer coisa, é só me chamar.`;
  try {
    const { token } = await ensureAudio(text);
    return { url: `/api/audio/${token}` };
  } catch (err) {
    return { error: err instanceof VoiceError ? err.message : "Não consegui gerar o áudio agora." };
  }
}

// Apaga a voz: some do serviço de voz e das configurações, e o assistente volta a responder só em texto.
export async function deleteMyVoice(): Promise<{ error?: string }> {
  await requireSession();
  const { voice } = await current();
  if (voice.voiceId) {
    try {
      await deleteVoice(voice.voiceId);
    } catch (err) {
      return { error: err instanceof VoiceError ? err.message : "Não consegui apagar a voz agora." };
    }
  }
  await save({ mode: "off", voiceId: null, voiceName: null, consentAt: null, createdAt: null });
  return {};
}
