import type { WhatsappHistoryMessage } from "@/lib/deskcomm";
import { mediaKindOf, type MediaKind } from "@/lib/mediaUnderstanding";

// O que fazer com UMA mensagem recebida do lead no WhatsApp. Pura (sem banco, sem rede).

// Mídia que o Deskcomm ainda não terminou de guardar: espera nas próximas leituras; passou disso,
// desistimos (e o corretor é avisado).
export const MEDIA_PENDING_GRACE_MS = 10 * 60 * 1000;

export type InboundPlan =
  | { action: "text"; text: string }
  | { action: "media"; kind: MediaKind; url: string; mime: string | null; caption: string | null }
  // A mídia ainda não está pronta: não mexe nesta conversa agora.
  | { action: "wait" }
  // Não sabemos entender (figurinha, local, contato, documento) ou o Deskcomm não entregou o arquivo.
  | { action: "unsupported"; label: string }
  // Figurinha: não é conteúdo pra responder nem motivo pra chamar o corretor. Segue a conversa sem ela.
  | { action: "ignore" };

const LABEL: Record<MediaKind, string> = { audio: "um áudio", image: "uma foto", video: "um vídeo" };

// O link do arquivo vem com o endereço que o Deskcomm usa por dentro (ex.: http://localhost:54321). Se esse
// endereço não é alcançável de fora, DESKCOMM_MEDIA_BASE_URL diz o público; troca só o começo (endereço),
// mantendo o caminho e a assinatura do link.
export function publicMediaUrl(url: string, base: string | undefined = process.env.DESKCOMM_MEDIA_BASE_URL): string {
  const b = base?.trim();
  if (!b) return url;
  try {
    const from = new URL(url);
    const to = new URL(b);
    return `${to.origin}${from.pathname}${from.search}`;
  } catch {
    return url;
  }
}

export function planInbound(m: WhatsappHistoryMessage, now: Date = new Date()): InboundPlan {
  const text = m.body?.trim() ?? "";
  const kind = mediaKindOf(m.type, m.media_mime);

  if (!kind) {
    if (text) return { action: "text", text };
    if ((m.type ?? "").toLowerCase() === "sticker") return { action: "ignore" };
    return { action: "unsupported", label: "um arquivo" };
  }

  if (m.media_signed_url) {
    return { action: "media", kind, url: publicMediaUrl(m.media_signed_url), mime: m.media_mime ?? null, caption: text || null };
  }

  const sentAt = m.sent_at ? new Date(m.sent_at) : now;
  if (m.media_status === "pending" && now.getTime() - sentAt.getTime() < MEDIA_PENDING_GRACE_MS) return { action: "wait" };

  // Sem o arquivo (versão do Deskcomm que não o entrega, ou demorou demais): só dá pra usar a legenda.
  if (text) return { action: "text", text };
  return { action: "unsupported", label: LABEL[kind] };
}
