import { nousClient } from "@/lib/agent";

// Entende áudio, foto e vídeo que o lead manda: baixa o arquivo e pede a um modelo que entende mídia
// (pelo Nous) o texto dele (transcrição ou descrição). O assistente continua a conversa em cima desse
// texto. Testado com áudio WAV/MP3/OGG, foto e vídeo em português: os modelos abaixo acertaram nomes,
// números e valores. Custo por mídia: de frações de centavo a ~US$ 0,004.

export type MediaKind = "audio" | "image" | "video";

export const MEDIA_MODEL_DEFAULT = "qwen/qwen3.8-omni-flash";
export const MEDIA_MODEL_FALLBACK = "google/gemini-3.8-flash";

export function mediaModel(): string {
  return process.env.NOUS_MODEL_MEDIA || MEDIA_MODEL_DEFAULT;
}

const MAX_BYTES: Record<MediaKind, number> = { audio: 16 * 1024 * 1024, image: 8 * 1024 * 1024, video: 20 * 1024 * 1024 };
const MAX_TEXT_CHARS = 2500;
const FETCH_TIMEOUT_MS = 25_000;

// Tipo da mensagem do WhatsApp (e o tipo do arquivo) -> o que sabemos entender. Figurinha, local e
// contato ficam de fora (o assistente passa pro corretor).
export function mediaKindOf(type: string | null | undefined, mime?: string | null): MediaKind | null {
  const t = (type ?? "").toLowerCase();
  const m = (mime ?? "").toLowerCase();
  if (t === "audio" || t === "ptt" || t === "voice" || m.startsWith("audio/")) return "audio";
  if (t === "image" || (m.startsWith("image/") && t !== "sticker")) return "image";
  if (t === "video" || m.startsWith("video/")) return "video";
  return null;
}

const KIND_LABEL: Record<MediaKind, string> = { audio: "Áudio", image: "Foto", video: "Vídeo" };

// Como a mídia aparece na conversa. O assistente sabe que o que vem depois do colchete foi tirado da
// mídia por um sistema automático (ver o prompt) e pode ter erro em nome ou número.
export function formatMediaMessage(kind: MediaKind, text: string, caption?: string | null): string {
  const cap = caption?.trim();
  return `[${KIND_LABEL[kind]}] ${text.trim()}${cap ? `\nLegenda: ${cap}` : ""}`;
}

const PROMPTS: Record<MediaKind, string> = {
  audio:
    "Transcreva fielmente, em português, o que a pessoa diz neste áudio. Não resuma, não corrija e não acrescente nada. " +
    "Trechos incompreensíveis: escreva [inaudível]. Se não houver fala nenhuma, responda exatamente: (sem fala)",
  image:
    "Esta imagem foi enviada por um cliente numa conversa de vendas. Descreva objetivamente o que aparece, em até 4 frases, " +
    "e transcreva exatamente os textos e números visíveis (nomes de empresas, valores, datas, quantidade de pessoas). " +
    "Se for um documento, diga qual. Não invente nada que não esteja visível. " +
    "Não transcreva números de documentos pessoais (CPF, RG), de cartão ou senhas: apenas diga que aparecem.",
  video:
    "Este vídeo foi enviado por um cliente numa conversa de vendas. Resuma o que é dito (transcreva fielmente as frases importantes) " +
    "e o que aparece. Transcreva exatamente números, valores e textos visíveis. Não invente nada. " +
    "Não transcreva números de documentos pessoais (CPF, RG), de cartão ou senhas: apenas diga que aparecem. Se não houver fala, diga.",
};

function audioFormat(mime: string | null | undefined): string {
  const m = (mime ?? "").toLowerCase();
  if (m.includes("ogg") || m.includes("opus")) return "ogg";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("wav")) return "wav";
  if (m.includes("mp4") || m.includes("m4a") || m.includes("aac")) return "m4a";
  return "ogg"; // mensagem de voz do WhatsApp
}

export type Part = Record<string, unknown>;

export function buildParts(kind: MediaKind, bytes: Buffer, mime: string | null | undefined): Part[] {
  const b64 = bytes.toString("base64");
  if (kind === "audio") return [{ type: "input_audio", input_audio: { data: b64, format: audioFormat(mime) } }];
  if (kind === "image") return [{ type: "image_url", image_url: { url: `data:${mime || "image/jpeg"};base64,${b64}` } }];
  return [{ type: "video_url", video_url: { url: `data:${mime || "video/mp4"};base64,${b64}` } }];
}

export type MediaResult = { ok: true; text: string; model: string } | { ok: false; reason: string };

export interface MediaDeps {
  fetchFn?: typeof fetch;
  // Pede o texto ao modelo (injetável nos testes).
  ask?: (model: string, prompt: string, parts: Part[]) => Promise<string>;
}

async function defaultAsk(model: string, prompt: string, parts: Part[]): Promise<string> {
  const r = await nousClient().chat.completions.create({
    model,
    max_tokens: 1500,
    messages: [{ role: "user", content: [{ type: "text", text: prompt }, ...parts] as never }],
  });
  return String(r.choices[0]?.message?.content ?? "").trim();
}

async function download(url: string, kind: MediaKind, fetchFn: typeof fetch): Promise<{ bytes: Buffer; mime: string | null } | string> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return "endereço da mídia inválido";
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return "endereço da mídia inválido";
  let res: Response;
  try {
    res = await fetchFn(u, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch {
    return "não consegui baixar o arquivo";
  }
  if (!res.ok) return `o arquivo não está disponível (${res.status})`;
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES[kind]) return "arquivo grande demais";
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length === 0) return "arquivo vazio";
  if (bytes.length > MAX_BYTES[kind]) return "arquivo grande demais";
  return { bytes, mime: res.headers.get("content-type")?.split(";")[0] ?? null };
}

const NO_SPEECH = /^\(?\s*sem fala\s*\)?\.?$/i;

export async function understandMedia(
  input: { url: string; kind: MediaKind; mime?: string | null },
  deps: MediaDeps = {},
): Promise<MediaResult> {
  const got = await download(input.url, input.kind, deps.fetchFn ?? fetch);
  if (typeof got === "string") return { ok: false, reason: got };
  const mime = input.mime || got.mime;
  const parts = buildParts(input.kind, got.bytes, mime);
  const ask = deps.ask ?? defaultAsk;

  let lastError = "";
  for (const model of [...new Set([mediaModel(), MEDIA_MODEL_FALLBACK])]) {
    try {
      const text = (await ask(model, PROMPTS[input.kind], parts)).trim();
      if (!text) {
        lastError = "o modelo não devolveu texto";
        continue;
      }
      if (NO_SPEECH.test(text)) return { ok: false, reason: input.kind === "audio" ? "o áudio não tem fala" : "não encontrei nada que dê pra entender" };
      return { ok: true, text: text.slice(0, MAX_TEXT_CHARS), model };
    } catch (err) {
      lastError = err instanceof Error ? err.message.slice(0, 120) : "erro ao entender a mídia";
    }
  }
  return { ok: false, reason: lastError || "não consegui entender a mídia" };
}
