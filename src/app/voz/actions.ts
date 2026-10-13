"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { VoiceError } from "@/lib/voice/fish";
import { listVoices, type CatalogVoice } from "@/lib/voice/elevenlabs";
import { removeVoice } from "@/lib/voice/engine";
import { ensureAudio } from "@/lib/voice/send";
import { EMPTY_VOICE, parseVoiceSettings, type AudioMode } from "@/lib/voice/settings";

async function current() {
  const s = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" }, select: { voiceSettings: true, ownerName: true, assistantName: true } });
  return { voice: parseVoiceSettings(s.voiceSettings), ownerName: s.ownerName?.trim() || null, assistantName: s.assistantName?.trim() || null };
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
  if (mode !== "off" && !voice.voiceId) return { error: "Escolha uma voz antes de ligar as mensagens de voz." };
  await save({ ...voice, mode });
  return {};
}

// Ouvir a própria voz falando uma frase de exemplo (o áudio fica no ar por 24 h, como os demais).
export async function previewMyVoice(): Promise<{ url?: string; error?: string }> {
  await requireSession();
  const { ownerName, voice, assistantName } = await current();
  // Voz pronta: quem fala é a assistente, não o dono da conta.
  const who = voice.provider === "elevenlabs" ? assistantName : ownerName;
  const text = `Oi, tudo bem? ${who ? `Aqui é ${who}. ` : ""}Recebi a sua mensagem e já te respondo com calma. Qualquer coisa, é só me chamar.`;
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
  try {
    await removeVoice(voice);
  } catch (err) {
    return { error: err instanceof VoiceError ? err.message : "Não consegui apagar a voz agora." };
  }
  await save(EMPTY_VOICE);
  return {};
}

// Lista de vozes prontas para escolher (cada uma com um trecho para ouvir).
export async function loadCatalogVoices(): Promise<{ voices?: CatalogVoice[]; error?: string }> {
  await requireSession();
  try {
    return { voices: await listVoices() };
  } catch (err) {
    return { error: err instanceof VoiceError ? err.message : "Não consegui carregar as vozes agora." };
  }
}

// Usa uma voz pronta da lista. A voz clonada, se existir, é apagada do serviço (o usuário pode gravar de novo depois).
export async function chooseCatalogVoice(voiceId: string, voiceName: string): Promise<{ error?: string }> {
  await requireSession();
  const id = voiceId.trim().slice(0, 80);
  if (!id) return { error: "Escolha uma voz." };
  const { voice } = await current();
  if (voice.provider === "fish" && voice.voiceId) await removeVoice(voice).catch(() => {});
  const now = new Date().toISOString();
  await save({ mode: voice.mode, provider: "elevenlabs", voiceId: id, voiceName: voiceName.trim().slice(0, 80) || null, consentAt: now, createdAt: now });
  return {};
}
