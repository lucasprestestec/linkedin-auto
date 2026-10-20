import { elevenConfigured } from "@/lib/voice/elevenlabs";

// Créditos da ElevenLabs no mês (1 crédito ≈ 1 caractere falado). No plano grátis são 10.000 por mês: em torno de
// 25 mensagens de voz. Quando acabam, o áudio falha e a resposta sai em texto; aqui só avisamos antes.
export interface VoiceUsage {
  used: number;
  limit: number;
  percent: number;
  resetAt: Date | null;
  plan: string | null;
}

export type VoiceLevel = "ok" | "aviso" | "acabou";

const CACHE_MS = 10 * 60 * 1000;
let cache: { at: number; value: VoiceUsage | null } | null = null;

// null = sem chave configurada ou a ElevenLabs não respondeu (não derruba nenhuma tela).
export async function elevenUsage(): Promise<VoiceUsage | null> {
  if (!elevenConfigured()) return null;
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  let value: VoiceUsage | null = null;
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY ?? "" },
      signal: AbortSignal.timeout(8_000),
    });
    if (res.ok) {
      const j = (await res.json()) as { character_count?: number; character_limit?: number; next_character_count_reset_unix?: number | null; tier?: string | null };
      const limit = Number(j.character_limit ?? 0);
      const used = Number(j.character_count ?? 0);
      if (limit > 0) value = { used, limit, percent: Math.round((used / limit) * 100), resetAt: j.next_character_count_reset_unix ? new Date(j.next_character_count_reset_unix * 1000) : null, plan: j.tier ?? null };
    }
  } catch {
    value = null;
  }
  cache = { at: Date.now(), value };
  return value;
}

export function voiceLevel(u: Pick<VoiceUsage, "percent"> | null): VoiceLevel {
  if (!u) return "ok";
  return u.percent >= 100 ? "acabou" : u.percent >= 80 ? "aviso" : "ok";
}

// Texto para o usuário (sem "crédito" nem "caractere"): quantas mensagens de voz ainda cabem, em média.
const CHARS_PER_VOICE_MESSAGE = 400;
export function voiceMessagesLeft(u: Pick<VoiceUsage, "used" | "limit">): number {
  return Math.max(0, Math.floor((u.limit - u.used) / CHARS_PER_VOICE_MESSAGE));
}

export function voiceNotice(u: VoiceUsage | null, assistant = "a assistente"): { level: VoiceLevel; title: string; sub: string } | null {
  const level = voiceLevel(u);
  if (!u || level === "ok") return null;
  const reset = u.resetAt ? ` Renova em ${u.resetAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" })}.` : "";
  return level === "acabou"
    ? { level, title: "As mensagens de voz do mês acabaram", sub: `${assistant[0].toUpperCase()}${assistant.slice(1)} está respondendo em texto até renovar.${reset} Para continuar com voz, fale com o suporte.` }
    : { level, title: "As mensagens de voz do mês estão acabando", sub: `Restam cerca de ${voiceMessagesLeft(u)} mensagens de voz (${u.percent}% usado).${reset}` };
}
