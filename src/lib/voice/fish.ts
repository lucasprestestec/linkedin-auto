// Cliente do Fish Audio (clonagem de voz e voz falada). Documentação oficial:
// POST /model (multipart: type=tts, title, train_mode=fast, voices=arquivos), POST /v1/tts
// (JSON com reference_id; cabeçalho "model"), DELETE /model/{id}. A chave fica só no servidor.

const BASE = "https://api.fish.audio";
// Modelos de fala, na ordem de tentativa. O gratuito e o mesmo modelo do pago a custo zero (sem garantia de
// disponibilidade). A API do Fish tem carteira propria (o credito da plataforma nao vale aqui): sem saldo no
// pago, a fala continua pelo gratuito. FISH_AUDIO_MODEL=s2.1-pro escolhe o pago como primeira opcao.
export const FREE_MODEL = "s2.1-pro-free";
export function ttsModels(): string[] {
  const chosen = process.env.FISH_AUDIO_MODEL?.trim();
  return chosen && chosen !== FREE_MODEL ? [chosen, FREE_MODEL] : [FREE_MODEL];
}
const TIMEOUT_MS = 60_000;

export class VoiceError extends Error {
  constructor(
    message: string,
    // Status HTTP do Fish quando o erro veio dele (402 = sem saldo na API).
    public readonly status?: number,
  ) {
    super(message);
  }
}

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
    throw new VoiceError(
      res.status === 402 ? "O serviço de voz está sem saldo na API (o crédito da plataforma não vale para a API)." : "O serviço de voz recusou a chave. Confira a configuração.",
      res.status,
    );
  }
  if (res.status === 429) throw new VoiceError("O serviço de voz está ocupado. Tente de novo em instantes.", 429);
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    throw new VoiceError(`O serviço de voz respondeu ${res.status}${detail ? `: ${detail}` : ""}.`, res.status);
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
  const models = ttsModels();
  let res: Response | null = null;
  for (let i = 0; i < models.length && !res; i++) {
    try {
      res = await call("/v1/tts", {
        method: "POST",
        headers: { "content-type": "application/json", model: models[i] },
        body: JSON.stringify({ text, reference_id: voiceId, format: "mp3", mp3_bitrate: 128, normalize: true, latency: "normal" }),
      });
    } catch (err) {
      // Sem saldo no modelo pago: segue pelo gratuito (mesmo modelo, sem garantia de disponibilidade).
      if (!(err instanceof VoiceError && err.status === 402 && i < models.length - 1)) throw err;
    }
  }
  if (!res) throw new VoiceError("O serviço de voz não respondeu.");
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length < 500) throw new VoiceError("O serviço de voz devolveu um áudio vazio.");
  return { bytes, mime: "audio/mpeg" };
}

export async function deleteVoice(voiceId: string): Promise<void> {
  await call(`/model/${encodeURIComponent(voiceId)}`, { method: "DELETE" });
}
