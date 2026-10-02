import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CHANNEL_LABEL } from "@/lib/channels";
import { clockTime, relativeTime } from "@/lib/format";
import { hasVoice, parseVoiceSettings } from "@/lib/voice/settings";
import { fishConfigured } from "@/lib/voice/fish";
import { publicBaseUrl } from "@/lib/voice/outgoingAudio";
import type { ApprovalItem } from "@/app/approvals/ApprovalCard";

const KIND_LABEL = {
  REPLY: "Resposta",
  OPENING: "Abertura",
  FIRST_CONTACT: "Primeiro contato",
  INTRO_EMAIL: "Apresentação por e-mail",
  FOLLOW_UP: "Retomada",
} as const;

const CONTEXT_MAX = 2;
const CONTEXT_CHARS = 280;

function clip(text: string) {
  return text.length > CONTEXT_CHARS ? `${text.slice(0, CONTEXT_CHARS).trimEnd()}…` : text;
}

// Rascunhos do assistente prontos para a tela de aprovação (e para aprovar dentro da conversa), cada um com
// o que o lead escreveu por último (até 2 mensagens, desde a última resposta nossa): quem aprova vê a que está respondendo.
export async function loadApprovalItems(where: Prisma.DraftWhereInput): Promise<ApprovalItem[]> {
  const [settings, drafts] = await Promise.all([
    prisma.settings.findUniqueOrThrow({ where: { id: "singleton" }, select: { voiceSettings: true } }),
    prisma.draft.findMany({ where, orderBy: { createdAt: "asc" }, include: { lead: { select: { firstName: true, lastName: true, jobTitle: true } } } }),
  ]);
  if (drafts.length === 0) return [];

  // Voz criada e autorizada, serviço de voz configurado e endereço público do sistema definido.
  const audioReady = hasVoice(parseVoiceSettings(settings.voiceSettings)) && fishConfigured() && Boolean(publicBaseUrl());

  const leadIds = [...new Set(drafts.map((d) => d.leadId))];
  const recent = await prisma.message.findMany({
    where: { leadId: { in: leadIds } },
    orderBy: { deliveredAt: "desc" },
    take: leadIds.length * 12,
    select: { leadId: true, sender: true, content: true, channel: true, deliveredAt: true },
  });
  const contextOf = (leadId: string) => {
    const out: { content: string; channel: string; when: string }[] = [];
    for (const m of recent) {
      if (m.leadId !== leadId) continue;
      if (m.sender !== "LEAD") break;
      if (out.length < CONTEXT_MAX) out.unshift({ content: clip(m.content), channel: CHANNEL_LABEL[m.channel], when: `${relativeTime(m.deliveredAt)} · ${clockTime(m.deliveredAt)}` });
    }
    return out;
  };

  return drafts.map((d) => ({
    id: d.id,
    leadId: d.leadId,
    firstName: d.lead.firstName,
    lastName: d.lead.lastName,
    jobTitle: d.lead.jobTitle,
    channel: CHANNEL_LABEL[d.channel],
    channelKey: d.channel,
    kind: KIND_LABEL[d.kind],
    subject: d.subject,
    content: d.content,
    reason: d.reason,
    asAudio: d.asAudio,
    canAudio: d.channel === "WHATSAPP" && audioReady,
    when: relativeTime(d.createdAt),
    context: d.kind === "REPLY" ? contextOf(d.leadId) : [],
  }));
}
