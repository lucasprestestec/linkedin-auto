// Cliente da ElevenLabs: lista de vozes prontas (para o usuário escolher) e voz falada. Documentação oficial:
// GET /v2/voices (cabeçalho xi-api-key) e POST /v1/text-to-speech/{voice_id}. A chave fica só no servidor.
import { VoiceError } from "@/lib/voice/fish";

const BASE = "https://api.elevenlabs.io";
// eleven_multilingual_v2 fala português. ELEVENLABS_MODEL troca (ex.: um modelo mais barato em créditos).
const MODEL = () => process.env.ELEVENLABS_MODEL?.trim() || "eleven_multilingual_v2";
const TIMEOUT_MS = 60_000;

export function elevenConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY);
}

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new VoiceError("O serviço de voz ainda não foi configurado.");
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers: { ...(init.headers as Record<string, string>), "xi-api-key": key }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new VoiceError("Não consegui falar com o serviço de voz agora. Tente de novo em instantes.");
  }
  if (res.status === 401) throw new VoiceError("O serviço de voz recusou a chave. Confira a configuração.", 401);
  if (res.status === 402 || res.status === 403) throw new VoiceError("A conta do serviço de voz não permite isto (limite do plano ou voz indisponível nele).", res.status);
  if (res.status === 429) throw new VoiceError("O serviço de voz está ocupado ou o limite do mês acabou. Tente de novo em instantes.", 429);
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    throw new VoiceError(`O serviço de voz respondeu ${res.status}${detail ? `: ${detail}` : ""}.`, res.status);
  }
  return res;
}

export interface CatalogVoice {
  id: string;
  name: string;
  // "feminina · adulta · americano": o que a ElevenLabs informa da voz, em uma linha.
  about: string;
  previewUrl: string | null;
}

const LABEL_PT: Record<string, string> = { female: "feminina", male: "masculina", young: "jovem", middle_aged: "meia-idade", old: "madura", neutral: "neutra" };

function aboutOf(labels: Record<string, string> | undefined, description: string | null | undefined): string {
  const l = labels ?? {};
  const parts = [l.gender, l.age, l.accent, l.use_case].filter(Boolean).map((v) => LABEL_PT[v as string] ?? (v as string).replace(/_/g, " "));
  return parts.length ? parts.join(" · ") : (description ?? "").slice(0, 80);
}

// Vozes prontas da conta (as "premade"): servem para quem não quer gravar a própria voz.
export async function listVoices(): Promise<CatalogVoice[]> {
  const res = await call("/v2/voices?page_size=100&category=premade&include_total_count=false");
  const data = (await res.json().catch(() => null)) as {
    voices?: { voice_id: string; name: string; labels?: Record<string, string>; description?: string | null; preview_url?: string | null }[];
  } | null;
  return (data?.voices ?? []).map((v) => ({ id: v.voice_id, name: v.name, about: aboutOf(v.labels, v.description), previewUrl: v.preview_url ?? null }));
}

// Fala o texto com a voz escolhida. Devolve MP3 (o WhatsApp converte pra mensagem de voz).
export async function synthesizeEleven(text: string, voiceId: string): Promise<{ bytes: Buffer; mime: string }> {
  const res = await call(`/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: MODEL() }),
  });
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length < 500) throw new VoiceError("O serviço de voz devolveu um áudio vazio.");
  return { bytes, mime: "audio/mpeg" };
}
