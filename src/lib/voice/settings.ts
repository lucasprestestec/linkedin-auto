import type { MessageChannel } from "@prisma/client";

// Preferências de voz do usuário: a voz clonada dele e QUANDO o assistente responde em áudio.
// Sem banco e sem rede (as telas também usam).

export type AudioMode = "off" | "mirror" | "always";

export interface VoiceSettings {
  mode: AudioMode;
  // Id da voz no provedor (não é segredo).
  voiceId: string | null;
  voiceName: string | null;
  // Quando o usuário confirmou que a voz é dele e autorizou o uso.
  consentAt: string | null;
  createdAt: string | null;
}

export const EMPTY_VOICE: VoiceSettings = { mode: "off", voiceId: null, voiceName: null, consentAt: null, createdAt: null };

export const AUDIO_MODES: { value: AudioMode; label: string; hint: string }[] = [
  { value: "off", label: "Só texto", hint: "O assistente nunca manda áudio." },
  {
    value: "mirror",
    label: "Responder em áudio quando o lead mandar áudio",
    hint: "Recomendado: quem manda áudio costuma preferir ouvir. Nas outras conversas, texto.",
  },
  {
    value: "always",
    label: "Responder sempre em áudio no WhatsApp",
    hint: "Respostas com link, número longo ou texto grande, e a confirmação de reunião, continuam em texto.",
  },
];

const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const date = (v: unknown) => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? v : null);

export function parseVoiceSettings(raw: unknown): VoiceSettings {
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const mode = o.mode === "mirror" || o.mode === "always" ? o.mode : "off";
  const voiceId = str(o.voiceId, 80);
  return {
    // Sem voz, não há como falar: o modo volta a "só texto".
    mode: voiceId ? mode : "off",
    voiceId,
    voiceName: str(o.voiceName, 80),
    consentAt: date(o.consentAt),
    createdAt: date(o.createdAt),
  };
}

export function hasVoice(s: VoiceSettings): boolean {
  return Boolean(s.voiceId && s.consentAt);
}

export function summarizeVoice(s: VoiceSettings): string {
  if (!hasVoice(s)) return "Voz ainda não criada";
  const mode = AUDIO_MODES.find((m) => m.value === s.mode)?.label ?? "";
  return `Sua voz está pronta · ${mode}`;
}

// Esta resposta sai em áudio? Só no WhatsApp, só com voz criada e autorizada e o serviço de voz
// configurado, e conforme a escolha do usuário. (Quem chama ainda confere se o TEXTO cabe em áudio.)
export function decideAudio(input: {
  settings: VoiceSettings;
  channel: MessageChannel;
  // Tipo da última mensagem do lead ("audio", "image", "video" ou nada).
  inboundKind: string | null | undefined;
  serviceReady: boolean;
}): boolean {
  const { settings, channel, inboundKind, serviceReady } = input;
  if (channel !== "WHATSAPP" || !serviceReady || !hasVoice(settings)) return false;
  if (settings.mode === "always") return true;
  if (settings.mode === "mirror") return inboundKind === "audio";
  return false;
}
