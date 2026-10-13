import { createHash } from "crypto";
import type { Lead } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendWhatsappAudio } from "@/lib/deskcomm";
import { synthesize, fishConfigured, VoiceError } from "@/lib/voice/fish";
import { audioUrl, findDraftAudio, publicBaseUrl, storeOutgoingAudio } from "@/lib/voice/outgoingAudio";
import { hasVoice, parseVoiceSettings } from "@/lib/voice/settings";
import { prepareSpeechText, speechIssues } from "@/lib/voice/speech";

// Gera (ou reaproveita) o áudio de um texto com a voz do usuário e devolve o código público dele.
export async function ensureAudio(text: string, opts: { draftId?: string | null } = {}): Promise<{ token: string; mime: string }> {
  const settings = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" }, select: { voiceSettings: true } });
  const voice = parseVoiceSettings(settings.voiceSettings);
  if (!hasVoice(voice)) throw new VoiceError("Você ainda não criou a sua voz.");
  if (!fishConfigured()) throw new VoiceError("O serviço de voz ainda não foi configurado.");

  if (opts.draftId) {
    const cached = await findDraftAudio(opts.draftId, text);
    if (cached) return { token: cached, mime: "audio/mpeg" };
  }
  const spoken = prepareSpeechText(text);
  if (!spoken) throw new VoiceError("Não há texto pra falar.");
  const audio = await synthesize(spoken, voice.voiceId!);
  const token = await storeOutgoingAudio(audio.bytes, audio.mime, { draftId: opts.draftId, text });
  return { token, mime: audio.mime };
}

// Manda a resposta como mensagem de voz (WhatsApp). Lança erro se qualquer etapa falhar: quem chama
// manda o texto no lugar.
export async function sendAudioMessage(lead: Lead, text: string, opts: { draftId?: string | null; sender?: "AGENT" | "HUMAN" } = {}) {
  const issues = speechIssues(text);
  if (issues.length) throw new VoiceError(`Este texto não vai em áudio: ${issues[0]}.`);
  if (!lead.whatsappConversationId) throw new VoiceError("Áudio só vai em uma conversa de WhatsApp que já existe.");
  if (!publicBaseUrl()) throw new VoiceError("O endereço público do sistema (APP_URL) não está configurado.");
  const { token, mime } = await ensureAudio(text, { draftId: opts.draftId });
  const url = audioUrl(token)!;
  const r = await sendWhatsappAudio({
    conversationId: lead.whatsappConversationId,
    mediaUrl: url,
    mime,
    // Mesmo áudio pra mesma pessoa no mesmo minuto = não reenvia (retry).
    idempotencyKey: `la-audio-${lead.id}-${createHash("sha256").update(token).digest("hex").slice(0, 16)}-${Math.floor(Date.now() / 60000)}`,
  });
  return prisma.message.create({
    data: {
      leadId: lead.id,
      sender: opts.sender ?? "AGENT",
      channel: "WHATSAPP",
      content: text,
      mediaKind: "audio",
      whatsappMessageId: r.messageId,
      deliveredAt: r.sentAt,
    },
  });
}
