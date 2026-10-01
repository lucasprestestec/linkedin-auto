// Cliente do Fish Audio (clonagem de voz e voz falada). Documentação oficial:
// POST /model (multipart: type=tts, title, train_mode=fast, voices=arquivos), POST /v1/tts
// (JSON com reference_id; cabeçalho "model"), DELETE /model/{id}. A chave fica só no servidor.

const BASE = "https://api.fish.audio";
const TTS_MODEL = "s2.1-pro";
const TIMEOUT_MS = 60_000;

export class VoiceError extends Error {}

export function fishConfigured(): boolean {
  return Boolean(process.env.FISH_AUDIO_API_KEY);
}

function key(): string {
  const k = process.env.FISH_AUDIO_API_KEY;
  if (!k) throw new VoiceError("O serviço de voz ainda não foi configurado.");
  return k;
}

async function call(path: string, init: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { ...(init.headers as Record<string, string>), authorization: `Bearer ${key()}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof VoiceError) throw err;
    throw new VoiceError("Não consegui falar com o serviço de voz agora. Tente de novo em instantes.");
  }
  if (res.status === 401 || res.status === 402 || res.status === 403) {
    throw new VoiceError(res.status === 402 ? "O serviço de voz está sem saldo." : "O serviço de voz recusou a chave. Confira a configuração.");
  }
  if (res.status === 429) throw new VoiceError("O serviço de voz está ocupado. Tente de novo em instantes.");
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    throw new VoiceError(`O serviço de voz respondeu ${res.status}${detail ? `: ${detail}` : ""}.`);
  }
  return res;
}

export interface VoiceSample {
  bytes: Uint8Array;
  filename: string;
  mime: string;
}

// Cria uma voz a partir da gravação do próprio usuário. Devolve o id (reference_id).
export async function createVoice(title: string, samples: VoiceSample[]): Promise<{ id: string; state: string }> {
  if (samples.length === 0) throw new VoiceError("Falta a gravação da voz.");
  const form = new FormData();
  form.set("type", "tts");
  form.set("title", title.slice(0, 80));
  form.set("train_mode", "fast");
  form.set("visibility", "private");
  form.set("enhance_audio_quality", "true");
  for (const s of samples.slice(0, 20)) form.append("voices", new Blob([s.bytes as BlobPart], { type: s.mime }), s.filename);
  const res = await call("/model", { method: "POST", body: form });
  const data = (await res.json().catch(() => null)) as { _id?: string; state?: string } | null;
  if (!data?._id) throw new VoiceError("O serviço de voz não devolveu a voz criada.");
  if (data.state === "failed") throw new VoiceError("Não foi possível criar a voz com essa gravação. Grave de novo, num lugar silencioso.");
  return { id: data._id, state: data.state ?? "created" };
}

// Fala o texto com a voz. Devolve MP3 (o WhatsApp converte pra mensagem de voz).
export async function synthesize(text: string, voiceId: string): Promise<{ bytes: Buffer; mime: string }> {
  const res = await call("/v1/tts", {
    method: "POST",
    headers: { "content-type": "application/json", model: TTS_MODEL },
    body: JSON.stringify({ text, reference_id: voiceId, format: "mp3", mp3_bitrate: 64, normalize: true, latency: "normal" }),
  });
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length < 500) throw new VoiceError("O serviço de voz devolveu um áudio vazio.");
  return { bytes, mime: "audio/mpeg" };
}

export async function deleteVoice(voiceId: string): Promise<void> {
  await call(`/model/${encodeURIComponent(voiceId)}`, { method: "DELETE" });
}
