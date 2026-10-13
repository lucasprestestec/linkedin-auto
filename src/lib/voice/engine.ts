// Escolhe o serviço de voz pela voz que o usuário configurou: a clonada (Fish) ou uma voz pronta (ElevenLabs).
import { deleteVoice, fishConfigured, synthesize, VoiceError } from "@/lib/voice/fish";
import { elevenConfigured, synthesizeEleven } from "@/lib/voice/elevenlabs";
import type { VoiceSettings } from "@/lib/voice/settings";

export function voiceServiceReady(voice: Pick<VoiceSettings, "provider">): boolean {
  return voice.provider === "elevenlabs" ? elevenConfigured() : fishConfigured();
}

export function speak(voice: Pick<VoiceSettings, "provider" | "voiceId">, text: string): Promise<{ bytes: Buffer; mime: string }> {
  if (!voice.voiceId) throw new VoiceError("Nenhuma voz escolhida.");
  return voice.provider === "elevenlabs" ? synthesizeEleven(text, voice.voiceId) : synthesize(text, voice.voiceId);
}

// Voz pronta não é nossa para apagar; só a clonada some do serviço.
export async function removeVoice(voice: Pick<VoiceSettings, "provider" | "voiceId">): Promise<void> {
  if (voice.provider === "fish" && voice.voiceId) await deleteVoice(voice.voiceId);
}
